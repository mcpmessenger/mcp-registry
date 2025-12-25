/**
 * Native Orchestrator
 * 
 * Orchestrates complex multi-step workflows using MCP tools directly.
 * This provides better performance, control, and integration than external orchestrators.
 */

import type { MCPServer } from './api'
import { getToolContext, type ToolContext } from '@/types/tool-context'
import { routeRequest, analyzeRoutingIntent } from './tool-router'

export interface WorkflowStep {
  step: number
  description: string
  requiredOutput: string
  toolContext: ToolContext | null
  selectedServer: MCPServer | null
  selectedTool: string | null
  result?: unknown
  error?: string
}

export interface WorkflowPlan {
  steps: WorkflowStep[]
  requiresParallelExecution: boolean
  estimatedDuration?: number
}

export interface WorkflowResult {
  success: boolean
  steps: WorkflowStep[]
  finalResult: unknown
  error?: string
}

export class NativeOrchestrator {
  private tools: Map<string, { server: MCPServer; tool: { name: string; description: string } }> = new Map()
  private toolContexts: Map<string, ToolContext> = new Map()
  private availableServers: MCPServer[] = []

  /**
   * Register available servers (called from discovery pipeline)
   */
  registerServers(servers: MCPServer[]) {
    this.availableServers = servers
    this.updateToolRegistry()
  }

  /**
   * Update tool registry from available servers
   */
  private updateToolRegistry() {
    this.tools.clear()
    this.toolContexts.clear()

    for (const server of this.availableServers) {
      const toolContext = getToolContext(server.serverId) || getToolContext(server.name)
      
      if (toolContext) {
        this.toolContexts.set(server.serverId, toolContext)
      }

      for (const tool of server.tools || []) {
        const toolKey = `${server.serverId}::${tool.name}`
        this.tools.set(toolKey, {
          server,
          tool: {
            name: tool.name,
            description: tool.description || '',
          },
        })
      }
    }
  }

  /**
   * Register a new server (called from discovery events)
   */
  registerServer(server: MCPServer) {
    const index = this.availableServers.findIndex(s => s.serverId === server.serverId)
    if (index >= 0) {
      this.availableServers[index] = server
    } else {
      this.availableServers.push(server)
    }
    this.updateToolRegistry()
  }

  /**
   * Unregister a server (called from discovery events)
   */
  unregisterServer(serverId: string) {
    this.availableServers = this.availableServers.filter(s => s.serverId !== serverId)
    this.updateToolRegistry()
  }

  /**
   * Plan a workflow from a user query
   */
  planWorkflow(query: string): WorkflowPlan {
    const intent = analyzeRoutingIntent(query)
    const steps: WorkflowStep[] = []

    // Detect multi-step queries
    const multiStepPatterns = [
      { pattern: /once you (?:have|find|get)/i, step: 2 },
      { pattern: /then (?:use|find|get)/i, step: 2 },
      { pattern: /after (?:finding|getting|having)/i, step: 2 },
      { pattern: /followed by/i, step: 2 },
      { pattern: /and then/i, step: 2 },
    ]

    let currentStep = 1
    let hasMultiStep = false

    // Check for explicit multi-step indicators
    for (const { pattern, step } of multiStepPatterns) {
      if (pattern.test(query)) {
        hasMultiStep = true
        currentStep = step
        break
      }
    }

    if (hasMultiStep || intent.needs.length > 1) {
      // Parse multi-step query
      // Improved regex to handle "once you have" patterns
      const splitRegex = /(?:once you (?:have|find|get)|then|after (?:finding|getting|having)|followed by|and then)/i
      const parts = query.split(splitRegex)
      
      // Also handle the "once you have X, use Y" pattern more explicitly
      const onceYouMatch = query.match(/once you (?:have|find|get) (.+?), use (.+?)(?:\.|$)/i)
      if (onceYouMatch) {
        // Extract the two parts more explicitly
        const firstPart = query.substring(0, query.indexOf('Once you') || query.indexOf('once you'))
        const secondPart = query.substring((query.indexOf('use ') + 4) || 0)
        
        if (firstPart && secondPart) {
          // Route first part
          const routing1 = routeRequest(firstPart.trim() || query.split(/once you/i)[0], this.availableServers)
          const toolContext1 = routing1.toolContext || (routing1.primaryServer ? getToolContext(routing1.primaryServer.serverId) : null)
          
          steps.push({
            step: 1,
            description: firstPart.trim() || query.split(/once you/i)[0].trim(),
            requiredOutput: toolContext1?.outputContext || 'result',
            toolContext: toolContext1 || null,
            selectedServer: routing1.primaryServer || null,
            selectedTool: routing1.primaryServer?.tools?.[0]?.name || null,
          })
          
          // Route second part (should use Google Maps based on description)
          const routing2 = routeRequest(secondPart.trim(), this.availableServers)
          const toolContext2 = routing2.toolContext || (routing2.primaryServer ? getToolContext(routing2.primaryServer.serverId) : null)
          
          steps.push({
            step: 2,
            description: secondPart.trim(),
            requiredOutput: toolContext2?.outputContext || 'result',
            toolContext: toolContext2 || null,
            selectedServer: routing2.primaryServer || null,
            selectedTool: routing2.primaryServer?.tools?.[0]?.name || null,
          })
        }
      } else {
        // Fallback to split method
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i].trim()
          if (!part) continue

          // Route each part to find appropriate tool
          const routing = routeRequest(part, this.availableServers)
          const toolContext = routing.toolContext || (routing.primaryServer ? getToolContext(routing.primaryServer.serverId) : null)

          steps.push({
            step: i + 1,
            description: part,
            requiredOutput: toolContext?.outputContext || 'result',
            toolContext: toolContext || null,
            selectedServer: routing.primaryServer || null,
            selectedTool: routing.primaryServer?.tools?.[0]?.name || null,
          })
        }
      }
    } else {
      // Single-step query
      const routing = routeRequest(query, this.availableServers)
      const toolContext = routing.toolContext || (routing.primaryServer ? getToolContext(routing.primaryServer.serverId) : null)

      steps.push({
        step: 1,
        description: query,
        requiredOutput: toolContext?.outputContext || 'result',
        toolContext: toolContext || null,
        selectedServer: routing.primaryServer || null,
        selectedTool: routing.primaryServer?.tools?.[0]?.name || null,
      })
    }

    return {
      steps,
      requiresParallelExecution: false, // TODO: Implement parallel detection
      estimatedDuration: steps.length * 30, // Estimate 30s per step
    }
  }

  /**
   * Select tools for a specific step
   */
  selectToolsForStep(step: WorkflowStep): Array<{ server: MCPServer; tool: string }> {
    if (step.selectedServer && step.selectedTool) {
      return [{ server: step.selectedServer, tool: step.selectedTool }]
    }

    // Fallback: find tools by output context
    if (step.toolContext) {
      const matching = Array.from(this.tools.values())
        .filter(({ server }) => {
          const context = getToolContext(server.serverId)
          return context?.outputContext === step.toolContext?.outputContext
        })
        .map(({ server, tool }) => ({ server, tool: tool.name }))

      return matching
    }

    return []
  }

  /**
   * Check if a query requires orchestration
   */
  requiresOrchestration(query: string): boolean {
    const intent = analyzeRoutingIntent(query)
    return intent.requiresOrchestration || false
  }

  /**
   * Get orchestrator status
   */
  getStatus() {
    return {
      registeredServers: this.availableServers.length,
      registeredTools: this.tools.size,
      toolContexts: this.toolContexts.size,
    }
  }
}

// Singleton instance
let orchestratorInstance: NativeOrchestrator | null = null

export function getNativeOrchestrator(): NativeOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new NativeOrchestrator()
  }
  return orchestratorInstance
}

