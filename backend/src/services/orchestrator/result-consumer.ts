/**
 * Shared Result Consumer
 * 
 * Maintains a single consumer that's always running to receive orchestrator results.
 * Uses a Map to track pending requests and resolve them when results arrive.
 */

import { createPulsarConsumer, receivePulsarMessage, type PulsarConsumer } from './pulsar'
import { isPulsarEnabled } from './messaging'
import { env } from '../../config/env'
import type { OrchestratorResultEvent } from './events'

// Helper to get topic name (works for both Kafka and Pulsar)
function getTopic(topicKey: keyof typeof env.pulsar.topics): string {
  return isPulsarEnabled() ? env.pulsar.topics[topicKey] : env.kafka.topics[topicKey]
}

type ResultResolver = {
  resolve: (result: OrchestratorResultEvent) => void
  reject: (error: Error) => void
  timeoutId: NodeJS.Timeout
}

let sharedConsumer: PulsarConsumer | any | null = null
let isRunning = false
let processingLoop: Promise<void> | null = null
const pendingRequests = new Map<string, ResultResolver>()

/**
 * Start the shared result consumer
 */
export async function startResultConsumer(): Promise<() => Promise<void>> {
  if (isRunning && sharedConsumer) {
    return async () => {
      isRunning = false
      if (isPulsarEnabled()) {
        await sharedConsumer?.close()
      } else {
        await sharedConsumer?.disconnect()
      }
      sharedConsumer = null
      isRunning = false
      pendingRequests.clear()
    }
  }

  // Use orchestrator namespace topic
  const topic = 'persistent://mcp-core/orchestrator/results'
  isRunning = true

  if (isPulsarEnabled()) {
    // Pulsar implementation
    const consumer = await createPulsarConsumer(topic, 'orchestrator-result-consumer')

    console.log('[Result Consumer] Started (Pulsar), listening for orchestrator results...')

    processingLoop = (async () => {
      while (isRunning) {
        try {
          const msg = await receivePulsarMessage(consumer, 1000)
          if (!msg) continue

          try {
            const event: OrchestratorResultEvent = JSON.parse(msg.getData().toString())
            const { requestId } = event

            const resolver = pendingRequests.get(requestId)
            if (resolver) {
              console.log(`[Result Consumer] Resolving request ${requestId}`)
              clearTimeout(resolver.timeoutId)
              pendingRequests.delete(requestId)
              resolver.resolve(event)
            } else {
              console.log(`[Result Consumer] Received result for unknown request ${requestId}`)
            }
            consumer.acknowledge(msg)
          } catch (error) {
            console.error('[Result Consumer] Error processing result:', error)
            consumer.negativeAcknowledge(msg)
          }
        } catch (error) {
          if (error instanceof Error && !error.message.includes('timeout')) {
            console.error('[Result Consumer] Error in processing loop:', error)
          }
        }
      }
    })()

    processingLoop.catch(error => {
      console.error('[Result Consumer] Processing loop crashed', error)
    })

    sharedConsumer = consumer
  } else {
    // Kafka implementation (legacy)
    const { createKafkaConsumer } = await import('./kafka')
    const consumer = createKafkaConsumer('orchestrator-result-consumer')
    await consumer.connect()
    await consumer.subscribe({ topic, fromBeginning: false })

    console.log('[Result Consumer] Started (Kafka), listening for orchestrator results...')

    consumer.run({
      eachMessage: async ({ message }) => {
        try {
          if (!message.value) return

          const event: OrchestratorResultEvent = JSON.parse(message.value.toString())
          const { requestId } = event

          const resolver = pendingRequests.get(requestId)
          if (resolver) {
            console.log(`[Result Consumer] Resolving request ${requestId}`)
            clearTimeout(resolver.timeoutId)
            pendingRequests.delete(requestId)
            resolver.resolve(event)
          } else {
            console.log(`[Result Consumer] Received result for unknown request ${requestId}`)
          }
        } catch (error) {
          console.error('[Result Consumer] Error processing result:', error)
        }
      },
    }).catch(error => {
      console.error('[Result Consumer] Consumer crashed', error)
    })

    sharedConsumer = consumer
  }

  return async () => {
    isRunning = false
    if (isPulsarEnabled()) {
      await sharedConsumer?.close()
    } else {
      await sharedConsumer?.disconnect()
    }
    sharedConsumer = null
    isRunning = false
    pendingRequests.clear()
  }
}

/**
 * Wait for a result for a specific request ID
 */
export function waitForResult(requestId: string, timeout: number = 20000): Promise<OrchestratorResultEvent> {
  return new Promise((resolve, reject) => {
    // Check if consumer is running
    if (!isRunning || !sharedConsumer) {
      reject(new Error('Result consumer is not running'))
      return
    }

    const timeoutId = setTimeout(() => {
      pendingRequests.delete(requestId)
      reject(new Error(`Request timed out waiting for orchestrator result`))
    }, timeout)

    pendingRequests.set(requestId, {
      resolve,
      reject,
      timeoutId,
    })

    console.log(`[Result Consumer] Waiting for result ${requestId} (${pendingRequests.size} pending)`)
  })
}

