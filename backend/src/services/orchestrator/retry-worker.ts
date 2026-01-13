/**
 * Retry Worker
 *
 * Consumes retry topics and republishes back to tool-signals after a fixed delay.
 * This provides a simple delayed-retry mechanism without external schedulers.
 */

import { createPulsarProducer, createPulsarConsumer, sendPulsarMessage, receivePulsarMessage, type PulsarProducer, type PulsarConsumer } from './pulsar'
import { isPulsarEnabled } from './messaging'
import { env } from '../../config/env'
import type { ToolSignalEvent } from './events'

// Helper to get topic name (works for both Kafka and Pulsar)
function getTopic(topicKey: keyof typeof env.pulsar.topics): string {
  return isPulsarEnabled() ? env.pulsar.topics[topicKey] : env.kafka.topics[topicKey]
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function topicDelayMs(topic: string): number {
  const retry5s = getTopic('toolSignalsRetry5s')
  const retry30s = getTopic('toolSignalsRetry30s')
  if (topic === retry5s) return 5000
  if (topic === retry30s) return 30000
  return 0
}

let consumerInstance5s: PulsarConsumer | any | null = null
let consumerInstance30s: PulsarConsumer | any | null = null
let producerInstance: PulsarProducer | any | null = null
let shutdownHandler: (() => Promise<void>) | null = null
let isRunning = false

export async function startRetryWorker(): Promise<() => Promise<void>> {
  if (shutdownHandler) {
    return shutdownHandler
  }

  const toolSignalsTopic = getTopic('toolSignals')
  const retry5sTopic = getTopic('toolSignalsRetry5s')
  const retry30sTopic = getTopic('toolSignalsRetry30s')
  isRunning = true

  if (isPulsarEnabled()) {
    // Pulsar implementation
    const producer = await createPulsarProducer(toolSignalsTopic)
    const consumer5s = await createPulsarConsumer(retry5sTopic, 'orchestrator-retry-worker')
    const consumer30s = await createPulsarConsumer(retry30sTopic, 'orchestrator-retry-worker')

    console.log('[Retry Worker] Started (Pulsar), listening for retry signals...')

    // Process 5s retry topic
    const process5s = async () => {
      while (isRunning) {
        try {
          const msg = await receivePulsarMessage(consumer5s, 1000)
          if (!msg) continue

          try {
            const signal: ToolSignalEvent = JSON.parse(msg.getData().toString())
            const waitMs = topicDelayMs(retry5sTopic)

            if (waitMs > 0) {
              console.log(
                `[Retry Worker] Delaying retry for request ${signal.requestId} by ${waitMs}ms (attempt=${signal.attempt ?? 0})`
              )
              await delay(waitMs)
            }

            // Republish to the main tool-signals topic
            await sendPulsarMessage(producer, {
              ...signal,
              timestamp: new Date().toISOString(),
            }, {
              requestId: signal.requestId,
              attempt: String(signal.attempt ?? 0),
            })

            consumer5s.acknowledge(msg)
          } catch (error: unknown) {
            console.error('[Retry Worker] Failed to process retry signal', error)
            consumer5s.negativeAcknowledge(msg)
          }
        } catch (error: unknown) {
          if (error instanceof Error && !error.message.includes('timeout')) {
            console.error('[Retry Worker] Error in 5s retry loop:', error)
          }
        }
      }
    }

    // Process 30s retry topic
    const process30s = async () => {
      while (isRunning) {
        try {
          const msg = await receivePulsarMessage(consumer30s, 1000)
          if (!msg) continue

          try {
            const signal: ToolSignalEvent = JSON.parse(msg.getData().toString())
            const waitMs = topicDelayMs(retry30sTopic)

            if (waitMs > 0) {
              console.log(
                `[Retry Worker] Delaying retry for request ${signal.requestId} by ${waitMs}ms (attempt=${signal.attempt ?? 0})`
              )
              await delay(waitMs)
            }

            // Republish to the main tool-signals topic
            await sendPulsarMessage(producer, {
              ...signal,
              timestamp: new Date().toISOString(),
            }, {
              requestId: signal.requestId,
              attempt: String(signal.attempt ?? 0),
            })

            consumer30s.acknowledge(msg)
          } catch (error: unknown) {
            console.error('[Retry Worker] Failed to process retry signal', error)
            consumer30s.negativeAcknowledge(msg)
          }
        } catch (error: unknown) {
          if (error instanceof Error && !error.message.includes('timeout')) {
            console.error('[Retry Worker] Error in 30s retry loop:', error)
          }
        }
      }
    }

    process5s().catch((error: unknown) => {
      console.error('[Retry Worker] 5s retry loop crashed', error)
    })

    process30s().catch((error: unknown) => {
      console.error('[Retry Worker] 30s retry loop crashed', error)
    })

    consumerInstance5s = consumer5s
    consumerInstance30s = consumer30s
    producerInstance = producer

    shutdownHandler = async (): Promise<void> => {
      isRunning = false
      if (consumerInstance5s) {
        await consumerInstance5s.close().catch(console.error)
        consumerInstance5s = null
      }
      if (consumerInstance30s) {
        await consumerInstance30s.close().catch(console.error)
        consumerInstance30s = null
      }
      if (producerInstance) {
        await producerInstance.close().catch(console.error)
        producerInstance = null
      }
      shutdownHandler = null
    }
  } else {
    // Kafka implementation (legacy)
    const { createKafkaConsumer, createKafkaProducer } = await import('./kafka')
    const producer = await createKafkaProducer()
    const consumer = createKafkaConsumer('orchestrator-retry-worker')
    await consumer.connect()

    await consumer.subscribe({ topic: retry5sTopic, fromBeginning: false })
    await consumer.subscribe({ topic: retry30sTopic, fromBeginning: false })

    console.log('[Retry Worker] Started (Kafka), listening for retry signals...')

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
            topic: toolSignalsTopic,
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

    consumerInstance5s = consumer
    producerInstance = producer

    shutdownHandler = async (): Promise<void> => {
      if (consumerInstance5s) {
        await consumerInstance5s.stop().catch((error: unknown) => {
          console.error('[Retry Worker] Consumer stop failed', error)
        })
        await consumerInstance5s.disconnect().catch((error: unknown) => {
          console.error('[Retry Worker] Consumer disconnect failed', error)
        })
        consumerInstance5s = null
      }
      producerInstance = null
      shutdownHandler = null
    }
  }

  return shutdownHandler
}

export async function stopRetryWorker(): Promise<void> {
  if (shutdownHandler) {
    await shutdownHandler()
  }
}

