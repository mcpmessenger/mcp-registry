import { kafka } from '../config/kafka'
import { env } from '../config/env'
import { registryService } from './registry.service'
import { eventBusService, type DLQEvent } from './event-bus.service'

/**
 * Healer Service
 * 
 * Watches the Dead Letter Queue (DLQ) for failed events and attempts recovery.
 * Implements compensating actions and Plan B strategies when workflows fail.
 */
export class HealerService {
  private consumer = kafka.consumer({
    groupId: `${env.kafka.groupId}-healer`,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  })
  private isRunning = false
  private maxRetries = 3
  private retryDelayMs = 5000 // 5 seconds between retries

  /**
   * Start the Healer service to watch the DLQ
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️  Healer service is already running')
      return
    }

    try {
      await this.consumer.connect()
      await this.consumer.subscribe({
        topics: ['mcp.events.dlq'],
        fromBeginning: false,
      })

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          if (!message.value) return

          try {
            const dlqEvent: DLQEvent = JSON.parse(message.value.toString())
            await this.handleFailedEvent(dlqEvent)
          } catch (error) {
            console.error('❌ Error processing DLQ event:', error)
          }
        },
      })

      this.isRunning = true
      console.log('✅ Healer service started - watching DLQ for failed events')
    } catch (error) {
      console.error('❌ Failed to start Healer service:', error)
      // Don't throw - Healer is optional
    }
  }

  /**
   * Stop the Healer service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return

    try {
      await this.consumer.stop()
      await this.consumer.disconnect()
      this.isRunning = false
      console.log('✅ Healer service stopped')
    } catch (error) {
      console.error('❌ Error stopping Healer service:', error)
    }
  }

  /**
   * Handle a failed event from the DLQ
   */
  private async handleFailedEvent(dlqEvent: DLQEvent): Promise<void> {
    const { originalEvent, error, retryCount, serverId, contextId } = dlqEvent

    console.log(`🔧 Healer processing failed event: ${originalEvent.event}`)
    console.log(`   Server: ${serverId}, Retry count: ${retryCount}, Error: ${error.message}`)

    // Get current workflow state
    const workflowState = await registryService.getWorkflowState(serverId)
    if (!workflowState) {
      console.warn(`⚠️  Server ${serverId} not found in registry`)
      return
    }

    // Check if we should retry
    if (retryCount < this.maxRetries) {
      console.log(`   Attempting retry ${retryCount + 1}/${this.maxRetries}...`)
      
      // Increment attempts in registry
      const newAttempts = await registryService.incrementWorkflowAttempts(serverId)
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * (retryCount + 1)))
      
      // Re-emit the original event for retry
      await eventBusService.emit({
        ...originalEvent,
        status: 'retry',
      })
      
      console.log(`   ✅ Re-emitted event for retry (attempt ${newAttempts})`)
      return
    }

    // Max retries exceeded - implement Plan B
    console.log(`   ❌ Max retries exceeded. Implementing Plan B...`)
    
    try {
      // Update registry state to PlanB
      await registryService.transitionWorkflowState(serverId, 'PlanB')
      
      // Try to find alternative tools or strategies
      const recoveryStrategy = await this.determineRecoveryStrategy(dlqEvent)
      
      if (recoveryStrategy) {
        console.log(`   🔄 Applying recovery strategy: ${recoveryStrategy.type}`)
        await this.applyRecoveryStrategy(recoveryStrategy, dlqEvent)
      } else {
        console.log(`   ⚠️  No recovery strategy found. Workflow marked as PlanB.`)
        
        // Emit a recovery event so other systems can handle it
        await eventBusService.emit({
          event: 'tool.healer.recover',
          serverId: 'system.healer',
          payload: {
            originalEvent: originalEvent.event,
            originalServerId: serverId,
            error: error.message,
            recoveryStatus: 'no_strategy',
          },
          conversationId: contextId,
          correlationId: originalEvent.correlationId,
          status: 'plan_b',
        })
      }
    } catch (recoveryError) {
      console.error('❌ Error during recovery:', recoveryError)
    }
  }

  /**
   * Determine recovery strategy based on the failed event
   */
  private async determineRecoveryStrategy(
    dlqEvent: DLQEvent
  ): Promise<{ type: string; action: any } | null> {
    const { originalEvent, error, serverId } = dlqEvent

    // Strategy 1: Tool-specific errors - try alternative tool
    if (error.message.includes('not found') || error.message.includes('404')) {
      return {
        type: 'alternative_tool',
        action: {
          findAlternative: true,
          serverId,
          originalTool: originalEvent.payload?.tool,
        },
      }
    }

    // Strategy 2: Timeout errors - retry with longer timeout
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return {
        type: 'extended_timeout',
        action: {
          retryWithTimeout: true,
          timeout: 60000, // 60 seconds
        },
      }
    }

    // Strategy 3: Rate limit errors - wait and retry
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return {
        type: 'rate_limit_wait',
        action: {
          waitAndRetry: true,
          waitTime: 60000, // 1 minute
        },
      }
    }

    // Strategy 4: Network errors - check connectivity and retry
    if (error.message.includes('ECONNREFUSED') || error.message.includes('network')) {
      return {
        type: 'network_retry',
        action: {
          checkConnectivity: true,
          retryAfterCheck: true,
        },
      }
    }

    // No specific strategy found
    return null
  }

  /**
   * Apply a recovery strategy
   */
  private async applyRecoveryStrategy(
    strategy: { type: string; action: any },
    dlqEvent: DLQEvent
  ): Promise<void> {
    const { originalEvent, serverId, contextId } = dlqEvent

    switch (strategy.type) {
      case 'alternative_tool':
        // Try to find and use an alternative tool
        // This would require querying the registry for alternative tools
        console.log(`   🔄 Attempting to find alternative tool for ${serverId}`)
        // For now, just emit a recovery event
        await eventBusService.emit({
          event: 'tool.healer.alternative_tool',
          serverId: 'system.healer',
          payload: {
            originalEvent: originalEvent.event,
            originalServerId: serverId,
            strategy: strategy.action,
          },
          conversationId: contextId,
          correlationId: originalEvent.correlationId,
          status: 'recovery',
        })
        break

      case 'extended_timeout':
        // Re-emit with extended timeout metadata
        await eventBusService.emit({
          ...originalEvent,
          payload: {
            ...originalEvent.payload,
            timeout: strategy.action.timeout,
          },
          status: 'retry_extended_timeout',
        })
        break

      case 'rate_limit_wait':
        // Wait and then retry
        console.log(`   ⏳ Waiting ${strategy.action.waitTime}ms for rate limit...`)
        await new Promise(resolve => setTimeout(resolve, strategy.action.waitTime))
        await eventBusService.emit({
          ...originalEvent,
          status: 'retry_after_rate_limit',
        })
        break

      case 'network_retry':
        // Check connectivity (simplified - just retry)
        console.log(`   🔄 Retrying after network error...`)
        await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10s
        await eventBusService.emit({
          ...originalEvent,
          status: 'retry_after_network_check',
        })
        break

      default:
        console.warn(`   ⚠️  Unknown recovery strategy: ${strategy.type}`)
    }
  }
}

export const healerService = new HealerService()
