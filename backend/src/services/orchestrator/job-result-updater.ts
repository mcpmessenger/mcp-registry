/**
 * Orchestrator Job Result Updater
 *
 * Consumes orchestrator results and persists them into OrchestratorJob rows.
 */

import { createPulsarConsumer, receivePulsarMessage, type PulsarConsumer } from './pulsar'
import { isPulsarEnabled } from './messaging'
import { JobStatus } from '@prisma/client'
import prisma from '../../config/database'
import { env } from '../../config/env'
import type { OrchestratorResultEvent } from './events'

// Helper to get topic name (works for both Kafka and Pulsar)
function getTopic(topicKey: keyof typeof env.pulsar.topics): string {
  return isPulsarEnabled() ? env.pulsar.topics[topicKey] : env.kafka.topics[topicKey]
}

let consumerInstance: PulsarConsumer | any | null = null
let shutdownHandler: (() => Promise<void>) | null = null
let isRunning = false

export async function startJobResultUpdater(): Promise<() => Promise<void>> {
  if (shutdownHandler) {
    return shutdownHandler
  }

  const topic = getTopic('orchestratorResults')
  isRunning = true

  if (isPulsarEnabled()) {
    // Pulsar implementation
    const consumer = await createPulsarConsumer(topic, 'orchestrator-job-result-updater')
    
    console.log('[Job Result Updater] Started (Pulsar), listening for orchestrator results...')
    
    const processLoop = async () => {
      while (isRunning) {
        try {
          const msg = await receivePulsarMessage(consumer, 1000)
          if (!msg) continue
          
          try {
            const event: OrchestratorResultEvent = JSON.parse(msg.getData().toString())
            const requestId = event.requestId
            
            const job = await prisma.orchestratorJob.findUnique({ where: { requestId } })
            if (!job) {
              console.log(`[Job Result Updater] No job found for requestId ${requestId}`)
              consumer.acknowledge(msg)
              continue
            }

            if (job.status === JobStatus.CANCELLED) {
              console.log(`[Job Result Updater] Job ${job.id} is cancelled; ignoring result`)
              consumer.acknowledge(msg)
              continue
            }

            if (event.status === 'failed' || event.error) {
              await prisma.orchestratorJob.update({
                where: { id: job.id },
                data: {
                  status: JobStatus.FAILED,
                  errorMessage: event.error || 'Unknown error',
                  completedAt: new Date(),
                },
              })
              consumer.acknowledge(msg)
              continue
            }

            await prisma.orchestratorJob.update({
              where: { id: job.id },
              data: {
                status: JobStatus.COMPLETED,
                resultJson: JSON.stringify({
                  status: event.status,
                  tool: event.tool,
                  toolPath: event.toolPath,
                  result: event.result,
                  plan: event.plan,
                }),
                completedAt: new Date(),
              },
            })
            
            consumer.acknowledge(msg)
          } catch (error) {
            console.error(`[Job Result Updater] Failed to process message`, error)
            consumer.negativeAcknowledge(msg)
          }
        } catch (error) {
          if (error instanceof Error && !error.message.includes('timeout')) {
            console.error('[Job Result Updater] Error in processing loop:', error)
          }
        }
      }
    }
    
    processLoop().catch(error => {
      console.error('[Job Result Updater] Processing loop crashed', error)
    })
    
    consumerInstance = consumer
  } else {
    // Kafka implementation (legacy)
    const { createKafkaConsumer } = await import('./kafka')
    const consumer = createKafkaConsumer('orchestrator-job-result-updater')
    await consumer.connect()
    await consumer.subscribe({ topic, fromBeginning: false })

    console.log('[Job Result Updater] Started (Kafka), listening for orchestrator results...')

    consumer
      .run({
        eachMessage: async ({ message }) => {
          if (!message.value) return

          let event: OrchestratorResultEvent
          try {
            event = JSON.parse(message.value.toString()) as OrchestratorResultEvent
          } catch (error) {
            console.error('[Job Result Updater] Failed to parse orchestrator result JSON', error)
            return
          }

          const requestId = event.requestId
          try {
            const job = await prisma.orchestratorJob.findUnique({ where: { requestId } })
            if (!job) {
              console.log(`[Job Result Updater] No job found for requestId ${requestId}`)
              return
            }

            if (job.status === JobStatus.CANCELLED) {
              console.log(`[Job Result Updater] Job ${job.id} is cancelled; ignoring result`)
              return
            }

            if (event.status === 'failed' || event.error) {
              await prisma.orchestratorJob.update({
                where: { id: job.id },
                data: {
                  status: JobStatus.FAILED,
                  errorMessage: event.error || 'Unknown error',
                  completedAt: new Date(),
                },
              })
              return
            }

            await prisma.orchestratorJob.update({
              where: { id: job.id },
              data: {
                status: JobStatus.COMPLETED,
                resultJson: JSON.stringify({
                  status: event.status,
                  tool: event.tool,
                  toolPath: event.toolPath,
                  result: event.result,
                  plan: event.plan,
                }),
                completedAt: new Date(),
              },
            })
          } catch (error) {
            console.error(`[Job Result Updater] Failed to persist result for requestId ${requestId}`, error)
          }
        },
      })
      .catch(error => {
        console.error('[Job Result Updater] Consumer crashed', error)
      })

    consumerInstance = consumer
  }

  shutdownHandler = async (): Promise<void> => {
    isRunning = false
    if (consumerInstance) {
      if (isPulsarEnabled()) {
        await consumerInstance.close().catch(console.error)
      } else {
        await consumerInstance.stop().catch(console.error)
        await consumerInstance.disconnect().catch(console.error)
      }
      consumerInstance = null
    }
    shutdownHandler = null
  }

  return shutdownHandler
}

export async function stopJobResultUpdater(): Promise<void> {
  if (shutdownHandler) {
    await shutdownHandler()
  }
}

