import { Kafka, Consumer, EachMessagePayload } from 'kafkajs'
import { env } from '../config/env'
import { multimodalWorkerService } from './multimodal-worker.service'
import type { DesignRequestReceivedPayload, KafkaEvent } from '../types/kafka-events'

/**
 * Design Request Consumer Service
 * 
 * Consumes DESIGN_REQUEST_RECEIVED events from the design-requests topic
 * and processes them using the Multimodal Worker Service.
 * 
 * This is the worker that does the actual heavy lifting of SVG generation.
 */
export class DesignRequestConsumerService {
  private consumer: Consumer
  private isRunning = false

  constructor(kafka: Kafka) {
    this.consumer = kafka.consumer({
      groupId: `${env.kafka.groupId}-design-worker`,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    })
  }

  /**
   * Start consuming design request events
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️  Design request consumer is already running')
      return
    }

    try {
      await this.consumer.connect()
      await this.consumer.subscribe({
        topics: [env.kafka.topics.designRequests],
        fromBeginning: false,
      })

      console.log(`📥 Design request consumer subscribed to topic: ${env.kafka.topics.designRequests}`)

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
          try {
            if (!message.value) {
              console.warn('⚠️  Received message with no value')
              return
            }

            const event: KafkaEvent<DesignRequestReceivedPayload> = JSON.parse(
              message.value.toString()
            )

            if (event.eventType === 'DESIGN_REQUEST_RECEIVED') {
              await this.handleDesignRequest(event.payload, event.metadata)
            }
          } catch (error) {
            console.error('❌ Error processing design request message:', error)
            // In production, you might want to send to a dead-letter queue
          }
        },
      })

      this.isRunning = true
      console.log('✅ Design request consumer started')
    } catch (error) {
      console.error('❌ Failed to start design request consumer:', error)
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
      await this.consumer.stop()
      await this.consumer.disconnect()
      this.isRunning = false
      console.log('✅ Design request consumer stopped')
    } catch (error) {
      console.error('❌ Error stopping design request consumer:', error)
    }
  }

  /**
   * Handle a design request event
   */
  private async handleDesignRequest(
    payload: DesignRequestReceivedPayload,
    metadata?: { userId?: string; clientId?: string; correlationId?: string }
  ): Promise<void> {
    console.log(`🔄 Processing design request for job ${payload.jobId}`)
    await multimodalWorkerService.processDesignRequest(payload, metadata)
  }
}
