import type { InvokeToolResponse } from '../mcp-invoke.service'

export type OrchestratorRequestId = string

export interface UserRequestEvent {
  requestId: OrchestratorRequestId
  normalizedQuery: string
  sessionId?: string
  contextSnapshot?: Record<string, unknown>
  metadata?: Record<string, unknown>
  timestamp: string
}

export type ToolSignalStatus = 'TOOL_READY'

export interface ToolSignalEvent {
  requestId: OrchestratorRequestId
  toolId: string
  serverId: string
  params?: Record<string, unknown>
  confidence: number
  status: ToolSignalStatus
  timestamp: string
}

export interface OrchestratorPlanStep {
  stepId?: string
  description: string
  toolId?: string
  serverId?: string
  params?: Record<string, unknown>
}

export interface OrchestratorPlanEvent {
  requestId: OrchestratorRequestId
  plan: OrchestratorPlanStep[]
  requiresOrchestration?: boolean
  steps?: string[]
  confidence?: number
  metadata?: Record<string, unknown>
  timestamp: string
}

export type OrchestratorResultStatus = 'tool' | 'plan' | 'failed'

export interface OrchestratorResultEvent {
  requestId: OrchestratorRequestId
  status: OrchestratorResultStatus
  tool?: string
  toolPath?: string
  result?: InvokeToolResponse['result']
  plan?: OrchestratorPlanEvent
  error?: string
  timestamp: string
}

export interface OrchestratorResultInit
  extends Omit<OrchestratorResultEvent, 'timestamp'> {}

export function createOrchestratorResultEvent(
  payload: OrchestratorResultInit
): OrchestratorResultEvent {
  return {
    ...payload,
    timestamp: new Date().toISOString(),
  }
}


