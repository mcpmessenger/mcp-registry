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
 * Extract venue information from text content
 */
function extractVenueFromText(text: string): Record<string, unknown> {
  const venue: Record<string, unknown> = {}
  
  // Try common patterns
  const venueMatch = text.match(/venue[:\s]+([^\n,\.]+)/i) ||
                    text.match(/(?:at|@)\s+([A-Z][^,\.\n]{3,})/) ||
                    text.match(/([A-Z][A-Za-z\s]+(?:Theater|Theatre|Arena|Stadium|Hall|Center|Centre|Park))/)
  
  if (venueMatch) {
    venue.venue = venueMatch[1].trim()
  }
  
  // Try to find date
  const dateMatch = text.match(/(\w+day,?\s+\w+\s+\d{1,2},?\s+\d{4})/i) ||
                   text.match(/(\w+\s+\d{1,2},?\s+\d{4})/i)
  if (dateMatch) {
    venue.date = dateMatch[1].trim()
  }
  
  return venue
}

/**
 * Invoke a single tool via the backend API
 */
async function invokeTool(invocation: ToolInvocation): Promise<ToolInvocationResult> {
  try {
    // Use the backend API endpoint for tool invocation
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

  // Get the most recent successful result
  const previousResult = previousResults
    .filter(r => r.result && !r.error)
    .slice(-1)[0]

  if (previousResult?.result) {
    const resultObj = previousResult.result as Record<string, unknown>
    
    // Extract venue information (for step 2 that needs venue from step 1)
    if (step.description.toLowerCase().includes('venue') || 
        step.description.toLowerCase().includes('car rental') ||
        step.description.toLowerCase().includes('closest')) {
      // Try multiple field names
      extracted.venue = resultObj.venue || resultObj.name || resultObj.title || resultObj.place
      extracted.location = resultObj.location || resultObj.address || resultObj.place_name
      extracted.coordinates = resultObj.coordinates || resultObj.location?.coordinates || resultObj.geometry?.coordinates
      
      // If we have a content field with text, try to parse venue from it
      if (resultObj.content && typeof resultObj.content === 'string') {
        const venueMatch = resultObj.content.match(/venue[:\s]+([^\n,]+)/i) ||
                          resultObj.content.match(/(?:at|@)\s+([A-Z][^,\.\n]+)/)
        if (venueMatch) {
          extracted.venue = venueMatch[1].trim()
        }
      }
    }

    // Extract location/place information
    extracted.place_id = resultObj.place_id || resultObj.id
    extracted.coordinates = extracted.coordinates || resultObj.coordinates || resultObj.location?.coordinates
    extracted.location = extracted.location || resultObj.location || resultObj.address
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

  // Determine tool type from server ID or description
  const isMapsTool = step.selectedServer?.serverId.includes('maps') || 
                     step.selectedTool === 'search_places' ||
                     step.description.toLowerCase().includes('google maps') ||
                     step.description.toLowerCase().includes('car rental') ||
                     step.description.toLowerCase().includes('closest')
  
  const isPlaywrightTool = step.selectedServer?.serverId.includes('playwright') ||
                           step.description.toLowerCase().includes('concert') ||
                           step.description.toLowerCase().includes('event') ||
                           step.description.toLowerCase().includes('ticket') ||
                           step.description.toLowerCase().includes('venue') ||
                           step.description.toLowerCase().includes('playing')
  
  if (isMapsTool) {
    // Google Maps tool
    const queryText = step.description || query
    // Extract search terms (e.g., "car rental agency" from "use Google Maps to find the closest available car rental agency")
    let searchQuery = queryText
    const findMatch = queryText.match(/find (.+?)(?: to| near| that| the|$)/i)
    if (findMatch) {
      searchQuery = findMatch[1]
    }
    // If we have venue from previous step, add "near [venue]"
    if (extracted.venue) {
      searchQuery = `${searchQuery} near ${extracted.venue}`
    } else if (previousResults.length > 0) {
      // Try to extract venue from previous step result
      const prevResult = previousResults[previousResults.length - 1]?.result
      if (prevResult && typeof prevResult === 'object') {
        const prevObj = prevResult as Record<string, unknown>
        if (prevObj.venue) {
          searchQuery = `${searchQuery} near ${prevObj.venue}`
        }
      }
    }
    args.text_query = searchQuery.trim()
    if (extracted.location || extracted.coordinates) {
      args.location_bias = { location: extracted.location || extracted.coordinates }
    }
  } else if (isPlaywrightTool) {
    // Playwright tool
    // Extract URL or search terms from description
    const urlMatch = step.description.match(/(https?:\/\/[^\s]+)/)
    if (urlMatch) {
      args.url = urlMatch[1]
    } else {
      // For concert searches, construct a search query
      const concertMatch = step.description.match(/find when ['"](.+?)['"] is playing/i) ||
                          step.description.match(/when (.+?) is playing/i)
      if (concertMatch) {
        args.query = `${concertMatch[1]} New York concert`
      } else {
        args.query = step.description
      }
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
        console.error(`[Workflow] Step ${step.step} has no tools available`)
        executedSteps.push(step)
        continue
      }

      // Use first matching tool
      const { server, tool } = toolSelections[0]

      // Build tool arguments
      const arguments_ = buildToolArguments(step, query, executedSteps)
      
      console.log(`[Workflow] Executing step ${step.step}: ${tool} on ${server.name}`, arguments_)

      // Invoke tool
      const invocation: ToolInvocation = {
        serverId: server.serverId,
        toolName: tool,
        arguments: arguments_,
      }

      const toolResult = await invokeTool(invocation)

      if (toolResult.success) {
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
            const parsed = JSON.parse(textContent)
            step.result = parsed
          } catch {
            // If not JSON, try to extract structured info from text
            step.result = { 
              content: textContent, 
              raw: toolResult.result,
              // Try to extract venue if it's a concert/event result
              ...(step.description.toLowerCase().includes('concert') || step.description.toLowerCase().includes('event') ? 
                extractVenueFromText(textContent) : {})
            }
          }
        } else {
          step.result = toolResult.result
        }

        finalResult = step.result
        console.log(`[Workflow] Step ${step.step} completed:`, step.result)
      } else {
        step.error = toolResult.error || 'Tool invocation failed'
        console.error(`[Workflow] Step ${step.step} failed:`, step.error)
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
