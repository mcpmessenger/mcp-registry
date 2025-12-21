import { env } from '../config/env'
import { kafka } from '../config/kafka'
import type { MCPEvent } from './event-bus.service'

type EventHandler = (event: MCPEvent) => Promise<void>

export class EventBusConsumerService {
  private handlers: Map<string, EventHandler[]> = new Map()
  private isRunning = false
  private consumer = kafka.consumer({
    groupId: `${env.kafka.groupId}-event-bus`,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  })

  /**
   * Register a handler for a specific event pattern
   * Pattern examples: "vision.captured", "vision.*", "*.captured"
   */
  registerHandler(pattern: string, handler: EventHandler): void {
    if (!this.handlers.has(pattern)) {
      this.handlers.set(pattern, [])
    }
    this.handlers.get(pattern)!.push(handler)
  }

  /**
   * Check if an event matches a pattern
   */
  private matchesPattern(event: string, pattern: string): boolean {
    // Simple pattern matching: * matches anything
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
    return regex.test(event)
  }

  /**
   * Start consuming events
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return
    }

    try {
      await this.consumer.connect()

      await this.consumer.subscribe({
        topics: ['mcp.events.all'],
        fromBeginning: false,
      })

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          if (!message.value) return

          try {
            const event: MCPEvent = JSON.parse(message.value.toString())

            // Find matching handlers
            for (const [pattern, handlers] of this.handlers.entries()) {
              if (this.matchesPattern(event.event, pattern)) {
                for (const handler of handlers) {
                  try {
                    await handler(event)
                  } catch (error) {
                    console.error(`Error in event handler for ${pattern}:`, error)
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error processing event:', error)
          }
        },
      })

      this.isRunning = true
      console.log('✅ Event bus consumer started')
    } catch (error) {
      console.error('❌ Failed to start event bus consumer:', error)
      // Don't throw - event bus is optional
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return
    try {
      await this.consumer.stop()
      this.isRunning = false
    } catch (error) {
      console.error('Error stopping event bus consumer:', error)
    }
  }
}

export const eventBusConsumerService = new EventBusConsumerService()
