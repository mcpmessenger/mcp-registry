import { kafkaProducer } from '../config/kafka'

export interface MCPEvent {
  event: string // e.g., "vision.captured", "data.processed"
  serverId: string
  payload: Record<string, any>
  timestamp: string
  conversationId?: string
  correlationId?: string
  intent?: string // User intent for the workflow
  tokenBudget?: number // Remaining token budget
  memorySnapshotUrl?: string // URL to memory snapshot
  status?: string // Event status (e.g., "success", "failed", "retry")
}

export interface DLQEvent extends MCPEvent {
  error: {
    message: string
    stack?: string
    code?: string
  }
  retryCount: number
  originalEvent: MCPEvent
  failedAt: string
}

export class EventBusService {
  /**
   * Emit an event that other servers can subscribe to
   */
  async emit(event: Omit<MCPEvent, 'timestamp'>): Promise<void> {
    const mcpEvent: MCPEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      status: event.status || 'success',
    }

    // Normalize serverId for topic name (replace / with .)
    const normalizedServerId = event.serverId.replace(/\//g, '.')
    const serverTopic = `mcp.events.${normalizedServerId}`

    try {
      // Publish to server-specific topic
      await kafkaProducer.send({
        topic: serverTopic,
        messages: [
          {
            key: event.event,
            value: JSON.stringify(mcpEvent),
          },
        ],
      })

      // Also publish to global topic for cross-server subscriptions
      await kafkaProducer.send({
        topic: 'mcp.events.all',
        messages: [
          {
            key: `${event.serverId}:${event.event}`,
            value: JSON.stringify(mcpEvent),
          },
        ],
      })
    } catch (error) {
      console.error('Failed to emit event:', error)
      // Don't throw - event emission should not break tool invocation
    }
  }

  /**
   * Emit a failed event to the Dead Letter Queue (DLQ)
   * This is called when an event fails after retries are exhausted
   */
  async emitToDLQ(
    originalEvent: MCPEvent,
    error: Error,
    retryCount: number
  ): Promise<void> {
    const dlqEvent: DLQEvent = {
      ...originalEvent,
      error: {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      },
      retryCount,
      originalEvent,
      failedAt: new Date().toISOString(),
      status: 'failed',
    }

    try {
      await kafkaProducer.send({
        topic: 'mcp.events.dlq',
        messages: [
          {
            key: `${originalEvent.serverId}:${originalEvent.event}`,
            value: JSON.stringify(dlqEvent),
            headers: {
              'retry-count': retryCount.toString(),
              'failed-at': dlqEvent.failedAt,
            },
          },
        ],
      })

      console.log(`📮 Sent failed event to DLQ: ${originalEvent.event} (retry ${retryCount})`)
    } catch (dlqError) {
      console.error('❌ Failed to send event to DLQ:', dlqError)
      // This is critical - if we can't send to DLQ, log it prominently
      console.error('Original event that failed:', originalEvent)
      console.error('Original error:', error)
    }
  }
}

export const eventBusService = new EventBusService()
