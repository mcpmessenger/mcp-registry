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
      // Handle complex queries with multiple sentences separated by periods
      // Split on sentence boundaries and transition words
      const sentenceBoundary = /([.!?])\s+(?=[A-Z])/g
      const sentences = query.split(sentenceBoundary).filter(s => s.trim().length > 0)
      
      // Reconstruct sentences (periods were split out)
      const reconstructedSentences: string[] = []
      for (let i = 0; i < sentences.length; i += 2) {
        if (i + 1 < sentences.length) {
          reconstructedSentences.push(sentences[i] + sentences[i + 1])
        } else {
          reconstructedSentences.push(sentences[i])
        }
      }
      
      // Parse each sentence and extract steps
      // Look for patterns like:
      // - "Find when X is playing in Y" (Step 1: Playwright)
      // - "Once you have the venue, use Google Maps to..." (Step 2: Maps)
      // - "Use Playwright to visit..." (Step 3: Playwright)
      // - "Finally, use LangChain to..." (Step 4: LangChain)
      
      const parts: string[] = []
      
      for (const sentence of reconstructedSentences) {
        // Check for explicit step transitions
        const onceYouMatch = sentence.match(/(?:once you (?:have|find|get)\s+the?\s+(\w+),?\s+use\s+(.+))/i)
        const finallyMatch = sentence.match(/(?:finally,?\s+use\s+(.+))/i)
        const thenMatch = sentence.match(/(?:then,?\s+use\s+(.+))/i)
        const useMatch = sentence.match(/(?:use\s+(.+?)\s+(?:to|for))/i)
        
        if (onceYouMatch) {
          // "Once you have the venue, use Google Maps to find..."
          // Previous sentence is step 1, this is step 2
          parts.push(sentence)
        } else if (finallyMatch || thenMatch) {
          // "Finally, use LangChain to..." or "Then use Playwright to..."
          parts.push(sentence)
        } else if (useMatch && (sentence.includes('Playwright') || sentence.includes('LangChain') || sentence.includes('Google Maps'))) {
          // Explicit tool usage
          parts.push(sentence)
        } else if (sentence.match(/find when|check ticketing|look for/i)) {
          // Concert/ticket search (Step 1)
          parts.push(sentence)
        } else if (sentence.trim().length > 10) {
          // Other meaningful sentences
          parts.push(sentence)
        }
      }
      
      // If we didn't get good splits, fall back to original approach
      if (parts.length === 0) {
        const splitRegex = /(?:once you (?:have|find|get)|then|after (?:finding|getting|having)|followed by|and then|finally|use (?:google maps|playwright|langchain))/i
        const fallbackParts = reconstructedSentences.flatMap(sentence => {
          if (splitRegex.test(sentence)) {
            return sentence.split(splitRegex).filter(p => p.trim().length > 0)
          }
          return [sentence]
        })
        parts.push(...fallbackParts)
      }
      
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
          
          // For step 1, if it's a concert/event search, prefer Playwright even if routing suggests LangChain
          let selectedServer = routing.primaryServer
          let selectedTool = routing.primaryServer?.tools?.[0]?.name || null
          
          if (i === 0) {
            const lowerPart = part.toLowerCase()
            const isConcertSearch = lowerPart.includes('playing') ||
                                   lowerPart.includes('concert') ||
                                   lowerPart.includes('event') ||
                                   lowerPart.includes('ticket') ||
                                   (lowerPart.includes('when') && lowerPart.includes('playing'))
            
            if (isConcertSearch) {
              // Override to use Playwright for concert searches
              const playwrightServer = this.availableServers.find(s => 
                s.serverId.includes('playwright') || s.name.toLowerCase().includes('playwright')
              )
              if (playwrightServer && playwrightServer.tools && playwrightServer.tools.length > 0) {
                selectedServer = playwrightServer
                selectedTool = playwrightServer.tools[0].name
              }
            }
          }
          
          const toolContext = routing.toolContext || (selectedServer ? getToolContext(selectedServer.serverId) : null)

          steps.push({
            step: i + 1,
            description: part,
            requiredOutput: toolContext?.outputContext || 'result',
            toolContext: toolContext || null,
            selectedServer: selectedServer || null,
            selectedTool: selectedTool,
          })
        }
      }
    } else {
      // Single-step query - check if it's actually a website check that needs Playwright
      const lowerQuery = query.toLowerCase()
      const isWebsiteCheck = lowerQuery.includes('using') && (lowerQuery.includes('.com') || lowerQuery.includes('ticketmaster') || lowerQuery.includes('check') || lowerQuery.includes('website'))
      
      // For website checks, prefer Playwright even if routing suggests LangChain
      if (isWebsiteCheck) {
        const playwrightServer = this.availableServers.find(s => 
          s.serverId.includes('playwright') || s.name.toLowerCase().includes('playwright')
        )
        
        if (playwrightServer && playwrightServer.tools && playwrightServer.tools.length > 0) {
          steps.push({
            step: 1,
            description: query,
            requiredOutput: 'Live Prices, Hidden Rules, Contact Details',
            toolContext: getToolContext('playwright') || null,
            selectedServer: playwrightServer,
            selectedTool: playwrightServer.tools[0].name,
          })
        } else {
          // Fallback to routing if Playwright not available
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
      } else {
        // Standard routing
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
    // If step already has server and tool selected, use them
    if (step.selectedServer && step.selectedTool) {
      // But verify it's the right tool type
      const description = step.description.toLowerCase()
      const isPlaywrightNeeded = description.includes('check') && (description.includes('website') || description.includes('site') || description.includes('ticket') || description.includes('concert') || description.includes('playwright'))
      const isMapsNeeded = description.includes('google maps') || description.includes('car rental') || description.includes('closest') || description.includes('near')
      
      // Override if wrong tool selected
      if (isPlaywrightNeeded && !step.selectedServer.serverId.includes('playwright')) {
        // Find Playwright server
        const playwrightServer = this.availableServers.find(s => 
          s.serverId.includes('playwright') || s.name.toLowerCase().includes('playwright')
        )
        if (playwrightServer && playwrightServer.tools && playwrightServer.tools.length > 0) {
          return [{ server: playwrightServer, tool: playwrightServer.tools[0].name }]
        }
      }
      
      if (isMapsNeeded && !step.selectedServer.serverId.includes('maps')) {
        // Find Google Maps server
        const mapsServer = this.availableServers.find(s => 
          s.serverId.includes('maps') || s.name.toLowerCase().includes('maps')
        )
        if (mapsServer && mapsServer.tools && mapsServer.tools.length > 0) {
          return [{ server: mapsServer, tool: mapsServer.tools[0].name }]
        }
      }
      
      return [{ server: step.selectedServer, tool: step.selectedTool }]
    }

    // Fallback: find tools by description keywords first
    const description = step.description.toLowerCase()
    
    // Check for Playwright needs
    if (description.includes('check') && (description.includes('website') || description.includes('site') || description.includes('ticket') || description.includes('concert') || description.includes('playwright'))) {
      const playwrightServer = this.availableServers.find(s => 
        s.serverId.includes('playwright') || s.name.toLowerCase().includes('playwright')
      )
      if (playwrightServer && playwrightServer.tools && playwrightServer.tools.length > 0) {
        return [{ server: playwrightServer, tool: playwrightServer.tools[0].name }]
      }
    }
    
    // Check for Google Maps needs
    if (description.includes('google maps') || description.includes('car rental') || description.includes('closest') || description.includes('near')) {
      const mapsServer = this.availableServers.find(s => 
        s.serverId.includes('maps') || s.name.toLowerCase().includes('maps')
      )
      if (mapsServer && mapsServer.tools && mapsServer.tools.length > 0) {
        return [{ server: mapsServer, tool: mapsServer.tools[0].name }]
      }
    }

    // Fallback: find tools by output context
    if (step.toolContext) {
      const matching = Array.from(this.tools.values())
        .filter(({ server }) => {
          const context = getToolContext(server.serverId)
          return context?.outputContext === step.toolContext?.outputContext
        })
        .map(({ server, tool }) => ({ server, tool: tool.name }))

      if (matching.length > 0) {
        return matching
      }
    }

    return []
  }

  /**
   * Check if a query requires orchestration
   */
  requiresOrchestration(query: string): boolean {
    const intent = analyzeRoutingIntent(query)
    const lowerQuery = query.toLowerCase()
    
    // Single-step concert queries should NOT require orchestration
    // Check for simple concert/event searches (these should go directly to Playwright)
    const isSimpleConcertQuery = (
      (lowerQuery.includes('playing') || lowerQuery.includes('concert') || lowerQuery.includes('ticket')) &&
      !lowerQuery.includes('once you') &&
      !lowerQuery.includes('then use') &&
      !lowerQuery.includes('finally') &&
      !lowerQuery.includes('followed by') &&
      !lowerQuery.match(/\.\s+(?:Once|Then|Finally|Use)/) // Not followed by multi-step phrases
    )
    
    // If it's a simple concert query, don't orchestrate
    if (isSimpleConcertQuery) {
      return false
    }
    
    // Also check for explicit multi-step indicators
    const multiStepPatterns = [
      /once you (?:have|find|get)/i,
      /then (?:use|find|get)/i,
      /after (?:finding|getting|having)/i,
      /followed by/i,
      /and then/i,
      /please check.*then use/i,
      /check.*and.*find/i,
    ]
    
    const hasMultiStep = multiStepPatterns.some(pattern => pattern.test(query))
    
    return intent.requiresOrchestration || hasMultiStep || intent.needs.length > 1
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

