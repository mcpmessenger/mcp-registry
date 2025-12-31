/**
 * Retry Worker
 *
 * Consumes retry topics and republishes back to tool-signals after a fixed delay.
 * This provides a simple delayed-retry mechanism without external schedulers.
 */

import type { Consumer, Producer } from 'kafkajs'
import { env } from '../../config/env'
import { createKafkaConsumer, createKafkaProducer } from './kafka'
import type { ToolSignalEvent } from './events'

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function topicDelayMs(topic: string): number {
  if (topic === env.kafka.topics.toolSignalsRetry5s) return 5000
  if (topic === env.kafka.topics.toolSignalsRetry30s) return 30000
  return 0
}

let consumerInstance: Consumer | null = null
let producerInstance: Producer | null = null
let shutdownHandler: (() => Promise<void>) | null = null

export async function startRetryWorker(): Promise<() => Promise<void>> {
  if (shutdownHandler) {
    return shutdownHandler
  }

  const producer = await createKafkaProducer()
  const consumer = createKafkaConsumer('orchestrator-retry-worker')
  await consumer.connect()

  await consumer.subscribe({ topic: env.kafka.topics.toolSignalsRetry5s, fromBeginning: false })
  await consumer.subscribe({ topic: env.kafka.topics.toolSignalsRetry30s, fromBeginning: false })

  console.log('[Retry Worker] Started, listening for retry signals...')

  consumer
    .run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return

        let signal: ToolSignalEvent
        try {
          signal = JSON.parse(message.value.toString()) as ToolSignalEvent
        } catch (error) {
          console.error('[Retry Worker] Failed to parse retry signal JSON', error)
          return
        }

        const waitMs = topicDelayMs(topic)
        if (waitMs > 0) {
          console.log(
            `[Retry Worker] Delaying retry for request ${signal.requestId} by ${waitMs}ms (attempt=${signal.attempt ?? 0})`
          )
          await delay(waitMs)
        }

        // Republish to the main tool-signals topic for coordinator consumption
        await producer.send({
          topic: env.kafka.topics.toolSignals,
          messages: [
            {
              key: signal.requestId,
              value: JSON.stringify({
                ...signal,
                timestamp: new Date().toISOString(),
              }),
              headers: {
                requestId: signal.requestId,
                attempt: String(signal.attempt ?? 0),
              },
            },
          ],
        })
      },
    })
    .catch(error => {
      console.error('[Retry Worker] Consumer crashed', error)
    })

  consumerInstance = consumer
  producerInstance = producer

  shutdownHandler = async (): Promise<void> => {
    if (consumerInstance) {
      await consumerInstance.stop().catch(error => {
        console.error('[Retry Worker] Consumer stop failed', error)
      })
      await consumerInstance.disconnect().catch(error => {
        console.error('[Retry Worker] Consumer disconnect failed', error)
      })
      consumerInstance = null
    }
    // producer is a shared singleton; do not disconnect it here
    producerInstance = null
    shutdownHandler = null
  }

  return shutdownHandler
}

export async function stopRetryWorker(): Promise<void> {
  if (shutdownHandler) {
    await shutdownHandler()
  }
}

