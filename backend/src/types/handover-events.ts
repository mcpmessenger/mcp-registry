/**
 * Standardized Handover Event Schema
 * 
 * This schema is used across all Kafka events for orchestration.
 * It ensures consistent payload format so orchestrators can easily
 * hydrate prompts and understand workflow context.
 * 
 * Reference: docs/agentic-orchestration.md
 */

/**
 * Standard handover event payload
 * All orchestration events should use this format
 */
export interface HandoverEventPayload {
  /**
   * Context ID (conversation ID) - links to memory snapshots
   */
  contextId: string

  /**
   * User intent - what the user is trying to accomplish
   */
  intent: string

  /**
   * Last tool output - result from the previous tool in the workflow
   */
  lastToolOutput?: {
    tool: string
    serverId: string
    result: any
    timestamp: string
  }

  /**
   * Memory snapshot URL - reference to stored memory state
   * Format: /api/memory?contextId=... or full URL
   */
  memorySnapshotUrl?: string

  /**
   * Token budget - remaining tokens available for this workflow
   */
  tokenBudget?: number

  /**
   * Event status - current state of the workflow
   */
  status: 'pending' | 'processing' | 'success' | 'failed' | 'retry' | 'plan_b'

  /**
   * Additional metadata specific to the event type
   */
  metadata?: Record<string, any>
}

/**
 * Standardized handover event
 * This is the format all orchestration events should follow
 */
export interface HandoverEvent {
  /**
   * Event type/name (e.g., "vision.analysis.completed", "tool.browser_take_screenshot.completed")
   */
  event: string

  /**
   * Server ID that generated this event
   */
  serverId: string

  /**
   * Standardized handover payload
   */
  payload: HandoverEventPayload

  /**
   * Timestamp when event was created
   */
  timestamp: string

  /**
   * Correlation ID for tracking related events
   */
  correlationId?: string
}

/**
 * Helper function to create a standardized handover event
 */
export function createHandoverEvent(
  event: string,
  serverId: string,
  contextId: string,
  intent: string,
  options?: {
    lastToolOutput?: HandoverEventPayload['lastToolOutput']
    memorySnapshotUrl?: string
    tokenBudget?: number
    status?: HandoverEventPayload['status']
    metadata?: Record<string, any>
    correlationId?: string
  }
): HandoverEvent {
  return {
    event,
    serverId,
    payload: {
      contextId,
      intent,
      lastToolOutput: options?.lastToolOutput,
      memorySnapshotUrl: options?.memorySnapshotUrl,
      tokenBudget: options?.tokenBudget,
      status: options?.status || 'success',
      metadata: options?.metadata,
    },
    timestamp: new Date().toISOString(),
    correlationId: options?.correlationId,
  }
}

/**
 * Convert MCPEvent to HandoverEvent format
 */
export function mcpEventToHandoverEvent(
  mcpEvent: {
    event: string
    serverId: string
    payload: Record<string, any>
    conversationId?: string
    correlationId?: string
    intent?: string
    tokenBudget?: number
    memorySnapshotUrl?: string
    status?: string
  }
): HandoverEvent {
  // Extract intent from payload or use default
  const intent = mcpEvent.intent || 
                 mcpEvent.payload.intent || 
                 mcpEvent.payload.query || 
                 'Unknown intent'

  // Extract last tool output if present
  const lastToolOutput = mcpEvent.payload.tool && mcpEvent.payload.result
    ? {
        tool: mcpEvent.payload.tool,
        serverId: mcpEvent.serverId,
        result: mcpEvent.payload.result,
        timestamp: mcpEvent.payload.timestamp || new Date().toISOString(),
      }
    : undefined

  return {
    event: mcpEvent.event,
    serverId: mcpEvent.serverId,
    payload: {
      contextId: mcpEvent.conversationId || mcpEvent.payload.contextId || '',
      intent,
      lastToolOutput,
      memorySnapshotUrl: mcpEvent.memorySnapshotUrl || mcpEvent.payload.memorySnapshotUrl,
      tokenBudget: mcpEvent.tokenBudget || mcpEvent.payload.tokenBudget,
      status: (mcpEvent.status || mcpEvent.payload.status || 'success') as HandoverEventPayload['status'],
      metadata: {
        ...mcpEvent.payload,
        // Remove fields that are now in standard locations
        tool: undefined,
        result: undefined,
        intent: undefined,
        contextId: undefined,
        memorySnapshotUrl: undefined,
        tokenBudget: undefined,
        status: undefined,
      },
    },
    timestamp: mcpEvent.payload.timestamp || new Date().toISOString(),
    correlationId: mcpEvent.correlationId || mcpEvent.payload.correlationId,
  }
}
