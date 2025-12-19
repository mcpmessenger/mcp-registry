import { kafkaProducer } from '../config/kafka'
import { env } from '../config/env'
import type {
  KafkaEvent,
  KafkaEventType,
  DesignRequestReceivedPayload,
  DesignReadyPayload,
  DesignFailedPayload,
} from '../types/kafka-events'
import { randomUUID } from 'crypto'

/**
 * Kafka Event Producer Service
 * Publishes events to Kafka topics (the "central nervous system")
 */
export class KafkaProducerService {
  /**
   * Publish a DESIGN_REQUEST_RECEIVED event
   * This is triggered when the API Gateway receives a design request
   */
  async publishDesignRequestReceived(
    payload: DesignRequestReceivedPayload,
    metadata?: { userId?: string; clientId?: string; correlationId?: string }
  ): Promise<void> {
    const event: KafkaEvent<DesignRequestReceivedPayload> = {
      eventId: randomUUID(),
      eventType: 'DESIGN_REQUEST_RECEIVED' as KafkaEventType,
      timestamp: new Date().toISOString(),
      jobId: payload.jobId,
      payload,
      metadata,
    }

    await this.publishEvent(env.kafka.topics.designRequests, event)
  }

  /**
   * Publish a DESIGN_READY event
   * This is triggered when a Multimodal Worker completes design generation
   */
  async publishDesignReady(
    payload: DesignReadyPayload,
    metadata?: { userId?: string; clientId?: string; correlationId?: string }
  ): Promise<void> {
    const event: KafkaEvent<DesignReadyPayload> = {
      eventId: randomUUID(),
      eventType: 'DESIGN_READY' as KafkaEventType,
      timestamp: new Date().toISOString(),
      jobId: payload.jobId,
      payload,
      metadata,
    }

    await this.publishEvent(env.kafka.topics.designReady, event)
  }

  /**
   * Publish a DESIGN_FAILED event
   * This is triggered when design generation fails
   */
  async publishDesignFailed(
    payload: DesignFailedPayload,
    metadata?: { userId?: string; clientId?: string; correlationId?: string }
  ): Promise<void> {
    const event: KafkaEvent<DesignFailedPayload> = {
      eventId: randomUUID(),
      eventType: 'DESIGN_FAILED' as KafkaEventType,
      timestamp: new Date().toISOString(),
      jobId: payload.jobId,
      payload,
      metadata,
    }

    await this.publishEvent(env.kafka.topics.designReady, event)
  }

  /**
   * Generic method to publish any event to a topic
   */
  private async publishEvent(topic: string, event: KafkaEvent): Promise<void> {
    try {
      await kafkaProducer.send({
        topic,
        messages: [
          {
            key: event.jobId, // Use jobId as key for partitioning
            value: JSON.stringify(event),
            headers: {
              'event-type': event.eventType,
              'event-id': event.eventId,
            },
          },
        ],
      })

      console.log(`📤 Published event ${event.eventType} for job ${event.jobId} to topic ${topic}`)
    } catch (error) {
      console.error(`❌ Failed to publish event ${event.eventType} to topic ${topic}:`, error)
      throw error
    }
  }
}

export const kafkaProducerService = new KafkaProducerService()
