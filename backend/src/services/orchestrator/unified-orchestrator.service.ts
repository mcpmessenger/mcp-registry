/**
 * Unified Orchestrator Service
 * 
 * Coordinates all Six Pillars of Orchestration:
 * 1. Semantic Search Engine
 * 2. Workflow Planner
 * 3. Execution Engine
 * 4. Enhanced Tool Matcher
 * 5. Context Manager
 * 6. Documentation Search
 */

import { getSemanticSearchService, type SemanticMatch } from './semantic-search.service'
import { getDocumentationSearchService, type DocumentationMatch } from './documentation-search.service'
import { MCPInvokeService } from '../mcp-invoke.service'
import { registryService } from '../registry.service'
import type { MCPServer } from '../../types/mcp'

export interface WorkflowStep {
  step: number
  description: string
  toolId: string
  serverId: string
  parameters: Record<string, unknown>
  dependencies?: number[] // Steps this depends on
  documentation?: DocumentationMatch
}

export interface WorkflowPlan {
  steps: WorkflowStep[]
  estimatedDuration: number
  confidence: number
  reasoning: string
}

export interface ExecutionResult {
  step: number
  success: boolean
  result?: unknown
  error?: string
  latency?: number
}

export interface WorkflowResult {
  success: boolean
  steps: ExecutionResult[]
  finalResult: unknown
  totalDuration: number
}

/**
 * Unified Orchestrator Service
 * 
 * Main entry point for orchestration that coordinates all pillars
 */
export class UnifiedOrchestratorService {
  private semanticSearch = getSemanticSearchService()
  private documentationSearch = getDocumentationSearchService()
  private mcpInvoker = new MCPInvokeService()
  private initialized: boolean = false

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    console.log('[UnifiedOrchestrator] Initializing all pillars...')
    
    // Initialize semantic search (Pillar 1)
    await this.semanticSearch.initialize()
    
    // Initialize documentation search (Pillar 6)
    await this.documentationSearch.initialize()
    
    this.initialized = true
    console.log('[UnifiedOrchestrator] All pillars initialized')
  }

  /**
   * Plan a workflow from a user query
   * Uses Semantic Search (Pillar 1) and Workflow Planner (Pillar 2)
   */
  async planWorkflow(query: string, context?: Record<string, unknown>): Promise<WorkflowPlan> {
    if (!this.initialized) {
      await this.initialize()
    }

    console.log(`[UnifiedOrchestrator] Planning workflow for: "${query.substring(0, 50)}..."`)

    // Step 1: Use Semantic Search Engine (Pillar 1) to find matching tools
    const semanticMatches = await this.semanticSearch.search(query, {
      limit: 5,
      minConfidence: 0.6,
    })

    if (semanticMatches.length === 0) {
      return {
        steps: [],
        estimatedDuration: 0,
        confidence: 0,
        reasoning: 'No matching tools found for query',
      }
    }

    // Step 2: Use Workflow Planner (Pillar 2) to decompose into steps
    const steps = await this.decomposeIntoSteps(query, semanticMatches, context)

    // Step 3: Enhance steps with Documentation Search (Pillar 6)
    const enhancedSteps = await this.enhanceStepsWithDocumentation(steps)

    // Calculate confidence and reasoning
    const confidence = semanticMatches[0]?.confidence || 0
    const reasoning = this.generateReasoning(semanticMatches, enhancedSteps)

    return {
      steps: enhancedSteps,
      estimatedDuration: enhancedSteps.length * 30, // 30s per step estimate
      confidence,
      reasoning,
    }
  }

  /**
   * Decompose query into workflow steps
   * Uses Workflow Planner (Pillar 2) logic
   */
  private async decomposeIntoSteps(
    query: string,
    matches: SemanticMatch[],
    context?: Record<string, unknown>
  ): Promise<WorkflowStep[]> {
    const steps: WorkflowStep[] = []
    const lowerQuery = query.toLowerCase()

    // Check for multi-step indicators
    const multiStepPatterns = [
      /once you (?:have|find|get)/i,
      /then (?:use|find|get)/i,
      /after (?:finding|getting|having)/i,
      /followed by/i,
      /and then/i,
    ]

    const hasMultiStep = multiStepPatterns.some(pattern => pattern.test(query))

    if (hasMultiStep) {
      // Multi-step query - parse into separate steps
      const parts = this.splitMultiStepQuery(query)
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const partMatches = await this.semanticSearch.search(part, { limit: 1, minConfidence: 0.6 })
        
        if (partMatches.length > 0) {
          const match = partMatches[0]
          steps.push({
            step: i + 1,
            description: part,
            toolId: match.tool.toolId,
            serverId: match.tool.serverId,
            parameters: this.extractParameters(part, match.tool),
            dependencies: i > 0 ? [i] : undefined, // Depend on previous step
          })
        }
      }
    } else {
      // Single-step query - use best match
      const bestMatch = matches[0]
      steps.push({
        step: 1,
        description: query,
        toolId: bestMatch.tool.toolId,
        serverId: bestMatch.tool.serverId,
        parameters: this.extractParameters(query, bestMatch.tool),
      })
    }

    return steps
  }

  /**
   * Split multi-step query into parts
   */
  private splitMultiStepQuery(query: string): string[] {
    const parts: string[] = []
    
    // Split on transition words
    const transitions = /(?:once you (?:have|find|get)|then|after (?:finding|getting|having)|followed by|and then)/i
    const split = query.split(transitions)
    
    // First part is before any transition
    if (split[0].trim()) {
      parts.push(split[0].trim())
    }
    
    // Remaining parts are after transitions
    for (let i = 1; i < split.length; i++) {
      if (split[i].trim()) {
        parts.push(split[i].trim())
      }
    }

    return parts.length > 0 ? parts : [query]
  }

  /**
   * Extract parameters from query for tool invocation
   */
  private extractParameters(query: string, tool: SemanticMatch['tool']): Record<string, unknown> {
    const params: Record<string, unknown> = {}

    // Google Maps lookup_weather tool requires location object with address
    if (tool.toolId === 'lookup_weather' || (tool.serverId?.includes('google-maps') && tool.toolId.includes('weather'))) {
      // Extract weather query: "what's the weather in Lake Forest CA" or "WHATS THE TEMP IN DES MOINES"
      const weatherMatch = query.match(/\b(what.*?temp|what.*?weather|whats.*?temp|whats.*?weather|temperature|temp|weather|forecast).*?(in|at|for|of)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)\b/i)
      if (weatherMatch) {
        const locationName = weatherMatch[3].trim()
        params.location = {
          address: locationName
        }
      } else {
        // Fallback: try to extract location from query (handle all caps)
        const locationMatch = query.match(/\b(in|at|for)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)\b/i)
        if (locationMatch) {
          params.location = {
            address: locationMatch[2].trim()
          }
        } else {
          // Use full query as address
          params.location = {
            address: query
          }
        }
      }
      return params
    }

    // Google Maps search_places tool requires textQuery (camelCase)
    // BUT exclude weather queries - they should use lookup_weather instead
    if ((tool.toolId === 'search_places' || (tool.serverId?.includes('google-maps') && tool.toolId.includes('search'))) 
        && !/\b(what.*?temp|what.*?weather|whats.*?temp|whats.*?weather|temperature|weather|forecast)\b/i.test(query)) {
      // Extract places query: "coffee shops in des moines"
      const placesMatch = query.match(/\b(find|search|look for|where)\s+(.+?)\s+(in|at|near)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)\b/i)
      if (placesMatch) {
        params.textQuery = `${placesMatch[2].trim()} in ${placesMatch[4].trim()}`
      } else {
        // Fallback: match "coffee shops in des moines" without "find/search"
        const simplePlacesMatch = query.match(/\b(.+?)\s+(in|at|near)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)\b/i)
        if (simplePlacesMatch) {
          params.textQuery = `${simplePlacesMatch[1].trim()} in ${simplePlacesMatch[3].trim()}`
        } else {
          params.textQuery = query
        }
      }
      return params
    }

    // Extract common parameters based on tool type
    if (tool.toolId.includes('search') || tool.toolId.includes('exa')) {
      // Extract search query
      const searchMatch = query.match(/(?:when|where|find|search|look for)\s+(.+?)(?:\s+in|\s+at|$)/i)
      if (searchMatch) {
        params.query = searchMatch[1].trim()
      } else {
        params.query = query
      }

      // Extract location
      const locationMatch = query.match(/\b(in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/i)
      if (locationMatch) {
        params.location = locationMatch[2].trim()
      }
    } else if (tool.toolId.includes('browser') || tool.toolId.includes('navigate')) {
      // Extract URL
      const urlMatch = query.match(/(https?:\/\/[^\s]+|[\w-]+\.(?:com|org|net|io))/i)
      if (urlMatch) {
        params.url = urlMatch[1].startsWith('http') ? urlMatch[1] : `https://www.${urlMatch[1]}`
      }

      // Extract search query
      const searchMatch = query.match(/(?:look for|search for|find)\s+(.+?)(?:\.|$)/i)
      if (searchMatch) {
        params.search_query = searchMatch[1].trim()
        params.auto_search = true
      }
    } else {
      // Generic: pass query as parameter
      params.query = query
      params.input = query
    }

    return params
  }

  /**
   * Enhance steps with documentation (Pillar 6)
   */
  private async enhanceStepsWithDocumentation(steps: WorkflowStep[]): Promise<WorkflowStep[]> {
    for (const step of steps) {
      const doc = await this.documentationSearch.getToolDocumentation(step.serverId, step.toolId)
      if (doc) {
        // Search for relevant documentation sections
        const docMatches = await this.documentationSearch.search(step.description, step.toolId, step.serverId)
        if (docMatches.length > 0) {
          step.documentation = docMatches[0]
          
          // Enhance parameters with documentation insights
          if (docMatches[0].documentation.bestPractices.length > 0) {
            // Could add validation or parameter enhancement here
          }
        }
      }
    }

    return steps
  }

  /**
   * Execute a workflow plan
   * Uses Execution Engine (Pillar 3) and Context Manager (Pillar 5)
   */
  async executeWorkflow(plan: WorkflowPlan, context?: Record<string, unknown>): Promise<WorkflowResult> {
    const startTime = Date.now()
    const results: ExecutionResult[] = []
    const contextData: Record<string, unknown> = { ...context }

    console.log(`[UnifiedOrchestrator] Executing workflow with ${plan.steps.length} step(s)`)

    for (const step of plan.steps) {
      const stepStartTime = Date.now()

      try {
        // Check dependencies
        if (step.dependencies) {
          for (const dep of step.dependencies) {
            const depResult = results[dep - 1]
            if (!depResult || !depResult.success) {
              throw new Error(`Dependency step ${dep} failed`)
            }
            // Merge dependency results into context
            if (depResult.result) {
              Object.assign(contextData, { [`step${dep}_result`]: depResult.result })
            }
          }
        }

        // Enhance parameters with context
        const enhancedParams = this.enhanceParametersWithContext(step.parameters, contextData, step.documentation)

        // Execute tool (Execution Engine - Pillar 3)
        const result = await this.mcpInvoker.invokeTool({
          serverId: step.serverId,
          tool: step.toolId,
          arguments: enhancedParams,
        })

        const latency = Date.now() - stepStartTime

        // Record usage for semantic search
        const isError = result.result?.isError ?? false
        await this.semanticSearch.recordUsage(step.serverId, step.toolId, !isError)

        results.push({
          step: step.step,
          success: !isError,
          result: result.result?.content,
          error: isError ? result.result?.content?.[0]?.text : undefined,
          latency,
        })

        // Update context with result (Context Manager - Pillar 5)
        if (result.result?.content && !isError) {
          contextData[`step${step.step}_result`] = result.result.content
        }

      } catch (error) {
        const latency = Date.now() - stepStartTime
        results.push({
          step: step.step,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          latency,
        })
      }
    }

    const totalDuration = Date.now() - startTime
    const success = results.every(r => r.success)

    return {
      success,
      steps: results,
      finalResult: results[results.length - 1]?.result || null,
      totalDuration,
    }
  }

  /**
   * Enhance parameters with context and documentation
   */
  private enhanceParametersWithContext(
    params: Record<string, unknown>,
    context: Record<string, unknown>,
    documentation?: DocumentationMatch
  ): Record<string, unknown> {
    const enhanced = { ...params }

    // Merge context data
    for (const [key, value] of Object.entries(context)) {
      if (key.startsWith('step') && key.endsWith('_result')) {
        // Extract relevant data from previous step results
        if (typeof value === 'object' && value !== null) {
          // Try to extract common fields
          const result = value as any
          if (result.venue) enhanced.venue = result.venue
          if (result.location) enhanced.location = result.location
          if (result.url) enhanced.url = result.url
        }
      }
    }

    // Apply documentation best practices
    if (documentation) {
      // Could add parameter validation or enhancement based on documentation
    }

    return enhanced
  }

  /**
   * Generate reasoning for the workflow plan
   */
  private generateReasoning(matches: SemanticMatch[], steps: WorkflowStep[]): string {
    const reasons: string[] = []

    if (matches.length > 0) {
      reasons.push(`Matched ${matches[0].tool.toolName} with ${(matches[0].confidence * 100).toFixed(1)}% confidence`)
      reasons.push(`Match type: ${matches[0].matchType}`)
    }

    if (steps.length > 1) {
      reasons.push(`Decomposed into ${steps.length} steps`)
    }

    if (steps.some(s => s.documentation)) {
      reasons.push(`Enhanced with documentation for ${steps.filter(s => s.documentation).length} step(s)`)
    }

    return reasons.join('. ')
  }
}

// Singleton instance
let unifiedOrchestratorInstance: UnifiedOrchestratorService | null = null

export function getUnifiedOrchestrator(): UnifiedOrchestratorService {
  if (!unifiedOrchestratorInstance) {
    unifiedOrchestratorInstance = new UnifiedOrchestratorService()
  }
  return unifiedOrchestratorInstance
}
