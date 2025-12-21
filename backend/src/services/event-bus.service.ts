import { kafkaProducer } from '../config/kafka'

export interface MCPEvent {
  event: string // e.g., "vision.captured", "data.processed"
  serverId: string
  payload: Record<string, any>
  timestamp: string
  conversationId?: string
  correlationId?: string
}

export class EventBusService {
  /**
   * Emit an event that other servers can subscribe to
   */
  async emit(event: Omit<MCPEvent, 'timestamp'>): Promise<void> {
    const mcpEvent: MCPEvent = {
      ...event,
      timestamp: new Date().toISOString(),
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
}

export const eventBusService = new EventBusService()
