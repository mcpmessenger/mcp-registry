/**
 * Workflow Executor
 * 
 * Executes multi-step workflows using the native orchestrator and MCP tool invocation
 */

import { getNativeOrchestrator, type WorkflowPlan, type WorkflowStep, type WorkflowResult } from './native-orchestrator'
import type { MCPServer } from './api'

export interface ToolInvocation {
  serverId: string
  toolName: string
  arguments: Record<string, unknown>
}

export interface ToolInvocationResult {
  success: boolean
  result?: unknown
  error?: string
  content?: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
  }>
}

/**
 * Invoke a single tool via the backend API
 */
async function invokeTool(invocation: ToolInvocation): Promise<ToolInvocationResult> {
  try {
    const response = await fetch('/api/mcp/tools/invoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serverId: invocation.serverId,
        tool: invocation.toolName,
        arguments: invocation.arguments,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      return {
        success: false,
        error: error.error || `HTTP ${response.status}`,
      }
    }

    const data = await response.json()
    return {
      success: true,
      result: data,
      content: data.result?.content || [],
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Extract data from previous step results for next step
 */
function extractDataFromStep(step: WorkflowStep, previousResults: WorkflowStep[]): Record<string, unknown> {
  // Simple extraction: look for common patterns in previous results
  const extracted: Record<string, unknown> = {}

  // Extract venue information
  if (step.description.toLowerCase().includes('venue')) {
    const previousResult = previousResults.find(r => r.result && typeof r.result === 'object')
    if (previousResult?.result) {
      const resultObj = previousResult.result as Record<string, unknown>
      if (resultObj.venue) extracted.venue = resultObj.venue
      if (resultObj.location) extracted.location = resultObj.location
      if (resultObj.address) extracted.address = resultObj.address
      if (resultObj.coordinates) extracted.coordinates = resultObj.coordinates
    }
  }

  // Extract location/place information
  if (step.description.toLowerCase().includes('location') || step.description.toLowerCase().includes('place')) {
    const previousResult = previousResults.find(r => r.result && typeof r.result === 'object')
    if (previousResult?.result) {
      const resultObj = previousResult.result as Record<string, unknown>
      if (resultObj.place_id) extracted.place_id = resultObj.place_id
      if (resultObj.coordinates) extracted.coordinates = resultObj.coordinates
      if (resultObj.location) extracted.location = resultObj.location
    }
  }

  return extracted
}

/**
 * Build tool arguments for a step based on query and previous results
 */
function buildToolArguments(
  step: WorkflowStep,
  query: string,
  previousResults: WorkflowStep[]
): Record<string, unknown> {
  const args: Record<string, unknown> = {}
  const extracted = extractDataFromStep(step, previousResults)

  // Merge extracted data
  Object.assign(args, extracted)

  // Build arguments based on tool type
  if (step.selectedServer?.serverId.includes('maps')) {
    // Google Maps tool
    const queryText = step.description || query
    args.text_query = queryText
    if (extracted.location) {
      args.location_bias = { location: extracted.location }
    }
  } else if (step.selectedServer?.serverId.includes('playwright')) {
    // Playwright tool
    // Extract URL or search terms from description
    const urlMatch = step.description.match(/(https?:\/\/[^\s]+)/)
    if (urlMatch) {
      args.url = urlMatch[1]
    } else {
      args.query = step.description
    }
  } else if (step.selectedTool === 'agent_executor') {
    // LangChain agent (fallback)
    args.query = step.description
  } else {
    // Generic: try to extract parameters from description
    args.query = step.description
    args.input = step.description
  }

  return args
}

/**
 * Execute a planned workflow
 */
export async function executeWorkflow(
  query: string,
  plan: WorkflowPlan
): Promise<WorkflowResult> {
  const executedSteps: WorkflowStep[] = []
  let finalResult: unknown = null

  try {
    for (const step of plan.steps) {
      // Select tools for this step
      const toolSelections = getNativeOrchestrator().selectToolsForStep(step)

      if (toolSelections.length === 0) {
        step.error = 'No suitable tool found for this step'
        executedSteps.push(step)
        continue
      }

      // Use first matching tool
      const { server, tool } = toolSelections[0]

      // Build tool arguments
      const arguments_ = buildToolArguments(step, query, executedSteps)

      // Invoke tool
      const invocation: ToolInvocation = {
        serverId: server.serverId,
        toolName: tool,
        arguments: arguments_,
      }

      const toolResult = await invokeTool(invocation)

      if (toolResult.success) {
        step.result = toolResult.result
        step.selectedServer = server
        step.selectedTool = tool

        // Extract text content for next step
        if (toolResult.content && toolResult.content.length > 0) {
          const textContent = toolResult.content
            .filter(c => c.type === 'text' && c.text)
            .map(c => c.text)
            .join('\n')

          // Try to parse structured data from text
          try {
            step.result = JSON.parse(textContent)
          } catch {
            step.result = { content: textContent, raw: toolResult.result }
          }
        }

        finalResult = step.result
      } else {
        step.error = toolResult.error || 'Tool invocation failed'
      }

      executedSteps.push(step)

      // Stop if step failed (unless we want to continue on error)
      if (!toolResult.success && step.step === 1) {
        break
      }
    }

    // Synthesize final result from all steps
    if (executedSteps.length > 1 && executedSteps.every(s => s.result)) {
      finalResult = {
        steps: executedSteps.map(s => ({
          step: s.step,
          description: s.description,
          result: s.result,
        })),
        summary: executedSteps.map(s => s.description).join(' → '),
      }
    }

    return {
      success: executedSteps.every(s => !s.error),
      steps: executedSteps,
      finalResult,
    }
  } catch (error) {
    return {
      success: false,
      steps: executedSteps,
      finalResult,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

