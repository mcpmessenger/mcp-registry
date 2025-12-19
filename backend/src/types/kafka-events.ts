/**
 * Kafka Event Types for Event-Driven Architecture
 */

export enum KafkaEventType {
  DESIGN_REQUEST_RECEIVED = 'DESIGN_REQUEST_RECEIVED',
  DESIGN_READY = 'DESIGN_READY',
  DESIGN_FAILED = 'DESIGN_FAILED',
}

/**
 * Base Kafka event interface
 */
export interface KafkaEvent<T = unknown> {
  eventId: string
  eventType: KafkaEventType
  timestamp: string
  jobId: string
  payload: T
  metadata?: {
    userId?: string
    clientId?: string
    correlationId?: string
  }
}

/**
 * DESIGN_REQUEST_RECEIVED event payload
 * Published when a design request is received from the API Gateway
 */
export interface DesignRequestReceivedPayload {
  jobId: string
  description: string
  style?: string
  colorPalette?: string[]
  size?: {
    width: number
    height: number
  }
  serverId?: string
  userId?: string
  clientId?: string
}

/**
 * DESIGN_READY event payload
 * Published when a design is successfully generated
 */
export interface DesignReadyPayload {
  jobId: string
  assetId: string
  svg?: string
  assetUrl?: string
  assetType: string
  metadata?: Record<string, unknown>
}

/**
 * DESIGN_FAILED event payload
 * Published when design generation fails
 */
export interface DesignFailedPayload {
  jobId: string
  errorMessage: string
  errorCode?: string
  retryable?: boolean
}
