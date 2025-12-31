/**
 * Orchestrator Job Result Updater
 *
 * Consumes orchestrator results and persists them into OrchestratorJob rows.
 */

import type { Consumer } from 'kafkajs'
import { JobStatus } from '@prisma/client'
import prisma from '../../config/database'
import { env } from '../../config/env'
import { createKafkaConsumer } from './kafka'
import type { OrchestratorResultEvent } from './events'

let consumerInstance: Consumer | null = null
let shutdownHandler: (() => Promise<void>) | null = null

export async function startJobResultUpdater(): Promise<() => Promise<void>> {
  if (shutdownHandler) {
    return shutdownHandler
  }

  const consumer = createKafkaConsumer('orchestrator-job-result-updater')
  await consumer.connect()
  await consumer.subscribe({ topic: env.kafka.topics.orchestratorResults, fromBeginning: false })

  console.log('[Job Result Updater] Started, listening for orchestrator results...')

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

  shutdownHandler = async (): Promise<void> => {
    if (consumerInstance) {
      await consumerInstance.stop().catch(error => {
        console.error('[Job Result Updater] Consumer stop failed', error)
      })
      await consumerInstance.disconnect().catch(error => {
        console.error('[Job Result Updater] Consumer disconnect failed', error)
      })
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

