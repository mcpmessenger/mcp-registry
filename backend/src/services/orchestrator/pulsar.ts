/**
 * Pulsar Client Utilities
 * 
 * Native Pulsar client implementation for orchestrator services.
 * This replaces kafkajs when using Pulsar directly (Phase II migration).
 * 
 * For Phase I (KoP bridge), continue using kafka.ts with Kafka protocol.
 */

import Pulsar from 'pulsar-client'
import { env } from '../../config/env'

let pulsarClient: Pulsar.Client | null = null
let clientConnecting = false

// Producer cache to prevent resource exhaustion
const producerCache = new Map<string, Pulsar.Producer>()

/**
 * Get or create a shared Pulsar client (singleton)
 */
export async function createPulsarClient(): Promise<Pulsar.Client> {
  if (pulsarClient) {
    return pulsarClient
  }

  if (clientConnecting) {
    // Wait for connection to complete
    while (clientConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (pulsarClient) {
      return pulsarClient
    }
  }

  clientConnecting = true
  try {
    pulsarClient = new Pulsar.Client({
      serviceUrl: env.pulsar.serviceUrl,
      operationTimeoutSeconds: 30,
    })
    console.log('[Pulsar] Client connected')
    return pulsarClient
  } finally {
    clientConnecting = false
  }
}

/**
 * Create a Pulsar producer with caching
 * 
 * Implements the "Producer Cache" pattern to prevent creating multiple producers
 * for the same topic, which would exhaust TCP connections and broker resources.
 * 
 * @param topic - Topic name (without namespace prefix)
 * @param namespace - Optional namespace override (for multi-tenant routing)
 */
export async function createPulsarProducer(
  topic: string,
  namespace?: string
): Promise<Pulsar.Producer> {
  const ns = namespace || env.pulsar.namespace
  const fullTopicName = `persistent://${ns}/${topic}`

  // Check cache first
  const cached = producerCache.get(fullTopicName)
  if (cached) {
    console.log(`[Pulsar] Using cached producer for: ${fullTopicName}`)
    return cached
  }

  // Create new producer
  const client = await createPulsarClient()
  const producer = await client.createProducer({
    topic: fullTopicName,
    sendTimeoutMs: 30000,
    batchingEnabled: true, // Enable batching for better throughput
    batchingMaxPublishDelayMs: 10, // Batch messages within 10ms window
    compressionType: 'LZ4', // Compress messages
  })

  // Cache the producer
  producerCache.set(fullTopicName, producer)

  console.log(`[Pulsar] Producer created and cached for: ${fullTopicName}`)
  return producer
}

/**
 * Create a Pulsar consumer with Key_Shared subscription
 * 
 * Key_Shared provides better load balancing than standard Shared subscriptions
 * by ensuring messages with the same key go to the same consumer, while still
 * distributing different keys across consumers.
 */
export async function createPulsarConsumer(
  topic: string,
  subscriptionName: string,
  subscriptionType: 'Exclusive' | 'Shared' | 'KeyShared' | 'Failover' = 'KeyShared'
): Promise<Pulsar.Consumer> {
  const client = await createPulsarClient()

  // Check if topic is already a full topic name (starts with persistent://)
  const fullTopicName = topic.startsWith('persistent://')
    ? topic
    : `persistent://${env.pulsar.namespace}/${topic}`

  const consumer = await client.subscribe({
    topic: fullTopicName,
    subscription: subscriptionName,
    subscriptionType, // Default to KeyShared for better load balancing
    ackTimeoutMs: 10000, // 10 second ack timeout
    receiverQueueSize: 100, // Smaller queue to prevent memory buildup (backpressure)
  })

  console.log(`[Pulsar] Consumer created for: ${fullTopicName}, subscription: ${subscriptionName}, type: ${subscriptionType}`)
  return consumer
}

/**
 * Send a message to a Pulsar topic with optional key for compaction
 * 
 * @param producer - Pulsar producer instance
 * @param message - Message payload (string or object)
 * @param properties - Optional message properties
 * @param key - Optional message key for ordering and compaction
 */
export async function sendPulsarMessage(
  producer: Pulsar.Producer,
  message: string | object,
  properties?: Record<string, string>,
  key?: string
): Promise<void> {
  const data = typeof message === 'string' ? Buffer.from(message) : Buffer.from(JSON.stringify(message))

  await producer.send({
    data,
    properties: properties || {},
    partitionKey: key, // Use key for message ordering and compaction
  })
}

/**
 * Receive messages from a Pulsar consumer
 * 
 * Usage:
 * ```typescript
 * const consumer = await createPulsarConsumer('user-requests', 'matcher-group')
 * while (true) {
 *   const msg = await receivePulsarMessage(consumer, 5000) // 5s timeout
 *   if (msg) {
 *     // Process message
 *     consumer.acknowledge(msg)
 *   }
 * }
 * ```
 */
export async function receivePulsarMessage(
  consumer: Pulsar.Consumer,
  timeoutMs: number = 10000
): Promise<Pulsar.Message | null> {
  try {
    const msg = await consumer.receive(timeoutMs)
    return msg
  } catch (error: any) {
    // Timeout is expected when no messages available
    if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
      return null
    }
    throw error
  }
}

/**
 * Close Pulsar client and cleanup all cached producers
 */
export async function closePulsarClient(): Promise<void> {
  // Close all cached producers
  for (const [topic, producer] of producerCache.entries()) {
    try {
      await producer.close()
      console.log(`[Pulsar] Closed cached producer for: ${topic}`)
    } catch (error) {
      console.error(`[Pulsar] Error closing producer for ${topic}:`, error)
    }
  }
  producerCache.clear()

  // Close client
  if (pulsarClient) {
    await pulsarClient.close()
    pulsarClient = null
    console.log('[Pulsar] Client closed')
  }
}

export type PulsarProducer = Pulsar.Producer
export type PulsarConsumer = Pulsar.Consumer
