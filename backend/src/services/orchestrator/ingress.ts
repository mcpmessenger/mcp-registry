/**
 * Ingress Gateway
 * 
 * Entry point for user requests. Normalizes queries and publishes to Kafka or Pulsar.
 */

import { randomUUID } from 'crypto'
import { createPulsarProducer, sendPulsarMessage } from './pulsar'
import { isPulsarEnabled } from './messaging'
import type { UserRequestEvent } from './events'
import { env } from '../../config/env'

/**
 * Determine namespace for multi-tenant routing (Phase III)
 * 
 * Returns namespace based on user_id or agent_id from request context.
 * Falls back to default namespace if not provided.
 */
function getNamespace(contextSnapshot?: Record<string, unknown>): string {
  // Check for user ID in context
  const userId = contextSnapshot?.userId as string | undefined
  if (userId) {
    return `tenant/${userId}/orchestrator`
  }
  
  // Check for agent ID in context
  const agentId = contextSnapshot?.agentId as string | undefined
  if (agentId) {
    return `tenant/${agentId}/execution`
  }
  
  // Check for user_id in metadata
  const metadata = contextSnapshot?.metadata
  const metadataUserId =
    metadata && typeof metadata === 'object' && 'userId' in metadata
      ? (metadata as { userId?: string }).userId
      : undefined
  if (metadataUserId) {
    return `tenant/${metadataUserId}/orchestrator`
  }
  
  // Default to configured namespace or public/default
  return env.pulsar.namespace || 'public/default'
}

/**
 * Normalize user query
 * - Strip "hey Gemini", "hey assistant", etc.
 * - Resolve contractions (when's -> when is, where's -> where is)
 * - Remove lingering context metadata
 */
export function normalizeQuery(query: string): string {
  let normalized = query.trim()
  
  // Remove greeting phrases
  normalized = normalized.replace(/^(hey|hi|hello)\s+(gemini|assistant|ai|bot)[,:\s]*/i, '')
  
  // Resolve common contractions
  normalized = normalized.replace(/\bwhen's\b/gi, 'when is')
  normalized = normalized.replace(/\bwhere's\b/gi, 'where is')
  normalized = normalized.replace(/\bwhat's\b/gi, 'what is')
  normalized = normalized.replace(/\bwho's\b/gi, 'who is')
  normalized = normalized.replace(/\bhow's\b/gi, 'how is')
  
  // Remove design context markers if present
  normalized = normalized.replace(/\[design[^\]]*\]/gi, '')
  normalized = normalized.replace(/\(design[^)]*\)/gi, '')
  
  return normalized.trim()
}

/**
 * Publish user request to Kafka or Pulsar
 */
export async function publishUserRequest(
  query: string,
  sessionId?: string,
  contextSnapshot?: Record<string, unknown>,
  requestIdOverride?: string
): Promise<string> {
  const requestId = requestIdOverride || randomUUID()
  const normalizedQuery = normalizeQuery(query)
  
  const event: UserRequestEvent = {
    requestId,
    normalizedQuery,
    sessionId,
    contextSnapshot,
    timestamp: new Date().toISOString(),
  }
  
  try {
    let topic: string
    let namespace: string | undefined
    
    if (isPulsarEnabled()) {
      // Phase III: Multi-tenant namespace routing
      namespace = getNamespace(contextSnapshot)
      topic = env.pulsar.topics.userRequests
      
      // Use native Pulsar client (Phase II/III)
      const fullTopicName = namespace 
        ? `persistent://${namespace}/${topic}`
        : `persistent://${env.pulsar.namespace}/${topic}`
      
      const producer = await createPulsarProducer(topic)
      // Note: For namespace routing, we need to create producer with full topic name
      // This is a simplified version - in production, createProducer should accept full topic name
      await sendPulsarMessage(producer, event, {
        requestId,
        sessionId: sessionId || '',
        namespace: namespace || env.pulsar.namespace,
      })
      await producer.close()
      
      const brokerType = namespace ? 'Pulsar (multi-tenant)' : 'Pulsar'
      console.log(`[Ingress] Published user request ${requestId} to ${brokerType} namespace ${namespace}: "${normalizedQuery.substring(0, 50)}..."`)
    } else {
      // Phase I: Kafka or KoP (no namespace routing)
      topic = env.kafka.topics.userRequests
      
      // Use Kafka client (Phase I: KoP or native Kafka) - lazy import to avoid loading when Pulsar is enabled
      const { createKafkaProducer } = await import('./kafka')
      const producer = await createKafkaProducer()
      await producer.send({
        topic,
        messages: [{
          key: requestId,
          value: JSON.stringify(event),
          headers: {
            requestId,
            sessionId: sessionId || '',
          },
        }],
      })
      
      console.log(`[Ingress] Published user request ${requestId} to Kafka: "${normalizedQuery.substring(0, 50)}..."`)
    }
    
    return requestId
  } catch (error) {
    console.error('[Ingress] Failed to publish user request:', error)
    const brokerType = isPulsarEnabled() ? 'Pulsar' : 'Kafka'
    throw new Error(`Failed to publish request to ${brokerType}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

