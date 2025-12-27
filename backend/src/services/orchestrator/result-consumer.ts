/**
 * Shared Result Consumer
 * 
 * Maintains a single consumer that's always running to receive orchestrator results.
 * Uses a Map to track pending requests and resolve them when results arrive.
 */

import { createKafkaConsumer } from './kafka'
import { env } from '../../config/env'
import type { OrchestratorResultEvent } from './events'
import type { Consumer } from 'kafkajs'

type ResultResolver = {
  resolve: (result: OrchestratorResultEvent) => void
  reject: (error: Error) => void
  timeoutId: NodeJS.Timeout
}

let sharedConsumer: Consumer | null = null
let isRunning = false
const pendingRequests = new Map<string, ResultResolver>()

/**
 * Start the shared result consumer
 */
export async function startResultConsumer(): Promise<() => Promise<void>> {
  if (isRunning && sharedConsumer) {
    return async () => {
      await sharedConsumer?.disconnect()
      sharedConsumer = null
      isRunning = false
      pendingRequests.clear()
    }
  }

  const consumer = createKafkaConsumer('orchestrator-result-consumer')
  await consumer.connect()
  await consumer.subscribe({ topic: env.kafka.topics.orchestratorResults, fromBeginning: false })

  console.log('[Result Consumer] Started, listening for orchestrator results...')

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
  isRunning = true

  return async () => {
    await consumer.disconnect()
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

