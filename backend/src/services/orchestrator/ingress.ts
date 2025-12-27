/**
 * Ingress Gateway
 * 
 * Entry point for user requests. Normalizes queries and publishes to Kafka.
 */

import { randomUUID } from 'crypto'
import { createKafkaProducer } from './kafka'
import type { UserRequestEvent } from './events'
import { env } from '../../config/env'

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
 * Publish user request to Kafka
 */
export async function publishUserRequest(
  query: string,
  sessionId?: string,
  contextSnapshot?: Record<string, unknown>
): Promise<string> {
  const requestId = randomUUID()
  const normalizedQuery = normalizeQuery(query)
  
  const event: UserRequestEvent = {
    requestId,
    normalizedQuery,
    sessionId,
    contextSnapshot,
    timestamp: new Date().toISOString(),
  }
  
  try {
    const producer = await createKafkaProducer()
    await producer.send({
      topic: env.kafka.topics.userRequests,
      messages: [{
        key: requestId,
        value: JSON.stringify(event),
        headers: {
          requestId,
          sessionId: sessionId || '',
        },
      }],
    })
    
    console.log(`[Ingress] Published user request ${requestId}: "${normalizedQuery.substring(0, 50)}..."`)
    return requestId
  } catch (error) {
    console.error('[Ingress] Failed to publish user request:', error)
    throw new Error(`Failed to publish request to Kafka: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

