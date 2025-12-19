import { kafkaConsumer } from '../config/kafka'
import { env } from '../config/env'
import type { KafkaEvent, DesignReadyPayload, DesignFailedPayload } from '../types/kafka-events'
import { jobTrackerService } from './job-tracker.service'
import { assetRepository } from '../repositories/asset.repository'
import { webSocketService } from './websocket.service'

/**
 * Kafka Event Consumer Service
 * Consumes events from Kafka topics and triggers business logic
 * 
 * This implements the "Multimodal Worker" pattern for design generation
 */
export class KafkaConsumerService {
  private isRunning = false

  /**
   * Start consuming events from Kafka topics
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️  Kafka consumer is already running')
      return
    }

    try {
      // Subscribe to topics
      await kafkaConsumer.subscribe({
        topics: [env.kafka.topics.designReady],
        fromBeginning: false,
      })

      console.log(`📥 Subscribed to topics: ${env.kafka.topics.designReady}`)

      // Start consuming
      await kafkaConsumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            if (!message.value) {
              console.warn('⚠️  Received message with no value')
              return
            }

            const event: KafkaEvent = JSON.parse(message.value.toString())
            await this.handleEvent(event)
          } catch (error) {
            console.error('❌ Error processing Kafka message:', error)
            // In production, you might want to send to a dead-letter queue
          }
        },
      })

      this.isRunning = true
      console.log('✅ Kafka consumer started')
    } catch (error) {
      console.error('❌ Failed to start Kafka consumer:', error)
      throw error
    }
  }

  /**
   * Stop consuming events
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    try {
      await kafkaConsumer.stop()
      this.isRunning = false
      console.log('✅ Kafka consumer stopped')
    } catch (error) {
      console.error('❌ Error stopping Kafka consumer:', error)
    }
  }

  /**
   * Handle incoming Kafka events
   */
  private async handleEvent(event: KafkaEvent): Promise<void> {
    console.log(`📨 Received event: ${event.eventType} for job ${event.jobId}`)

    switch (event.eventType) {
      case 'DESIGN_READY':
        await this.handleDesignReady(event.payload as DesignReadyPayload, event.jobId)
        break

      case 'DESIGN_FAILED':
        await this.handleDesignFailed(event.payload as DesignFailedPayload, event.jobId)
        break

      default:
        console.warn(`⚠️  Unknown event type: ${event.eventType}`)
    }
  }

  /**
   * Handle DESIGN_READY event
   * Updates job status and pushes result to frontend via WebSocket
   */
  private async handleDesignReady(payload: DesignReadyPayload, jobId: string): Promise<void> {
    try {
      // Update job status
      await jobTrackerService.completeJob(jobId, 'Design generated successfully')

      // Update asset if needed (might already exist from worker)
      const job = await jobTrackerService.getJob(jobId)
      if (job && payload.svg) {
        // Ensure asset exists
        const existingAssets = await assetRepository.findByJobId(jobId)
        if (existingAssets.length === 0) {
          await assetRepository.create({
            job: { connect: { id: jobId } },
            assetType: payload.assetType || 'svg',
            content: payload.svg,
            url: payload.assetUrl,
            version: 1,
            isLatest: true,
          })
        }
      }

      // Push to frontend via WebSocket
      // The WebSocketService will handle broadcasting to subscribed clients
      console.log(`✅ Design ready for job ${jobId}, result pushed to frontend`)

      // Note: WebSocket push happens automatically via jobTrackerService subscribers
      // which are set up in the WebSocketService
    } catch (error) {
      console.error(`❌ Error handling DESIGN_READY for job ${jobId}:`, error)
    }
  }

  /**
   * Handle DESIGN_FAILED event
   * Updates job status to failed and notifies frontend
   */
  private async handleDesignFailed(payload: DesignFailedPayload, jobId: string): Promise<void> {
    try {
      await jobTrackerService.failJob(jobId, payload.errorMessage)

      console.log(`❌ Design generation failed for job ${jobId}: ${payload.errorMessage}`)

      // Note: WebSocket push happens automatically via jobTrackerService subscribers
    } catch (error) {
      console.error(`❌ Error handling DESIGN_FAILED for job ${jobId}:`, error)
    }
  }
}

export const kafkaConsumerService = new KafkaConsumerService()
