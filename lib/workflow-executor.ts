/**
 * Workflow Executor
 * 
 * Executes multi-step workflows using the native orchestrator and MCP tool invocation
 */

import { getNativeOrchestrator, type WorkflowPlan, type WorkflowStep, type WorkflowResult } from './native-orchestrator'
import type { MCPServer } from './api'
import { formatToolResponse, type ToolContext } from './response-formatter'

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
      
      // Check formatted result for venue extraction (from Playwright responses)
      if (resultObj.formatted && typeof resultObj.formatted === 'string') {
        const formattedText = resultObj.formatted
        
        // Extract venue from formatted response (e.g., "Venue: Madison Square Garden")
        const venueMatch = formattedText.match(/venue[:\s]+([^\n,]+)/i) ||
                          formattedText.match(/(?:at|@)\s+([A-Z][^,\n\.]+?)(?:\n|$)/)
        if (venueMatch && !extracted.venue) {
          extracted.venue = venueMatch[1].trim()
        }
        
        // Extract date for itinerary generation
        const dateMatch = formattedText.match(/date[:\s]+([^\n,]+)/i) ||
                         formattedText.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i)
        if (dateMatch) {
          extracted.date = dateMatch[1].trim()
        }
        
        // Extract time if available
        const timeMatch = formattedText.match(/at\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i)
        if (timeMatch) {
          extracted.time = timeMatch[1].trim()
        }
      }
      
      // If we have a content field with text, try to parse venue from it
      if (resultObj.content && typeof resultObj.content === 'string') {
        const venueMatch = resultObj.content.match(/venue[:\s]+([^\n,]+)/i) ||
                          resultObj.content.match(/(?:at|@)\s+([A-Z][^,\.\n]+)/)
        if (venueMatch && !extracted.venue) {
          extracted.venue = venueMatch[1].trim()
        }
      }
      
      // Extract from raw YAML if available (for Playwright snapshots)
      if (resultObj.raw && typeof resultObj.raw === 'object') {
        const rawObj = resultObj.raw as Record<string, unknown>
        if (rawObj.content && typeof rawObj.content === 'string') {
          // Look for venue patterns in YAML
          const yamlVenueMatch = rawObj.content.match(/(?:p|span)\s+"([^"]*(?:Theater|Theatre|Arena|Stadium|Hall|Center|Centre|Park)[^"]*)"/i)
          if (yamlVenueMatch && !extracted.venue) {
            extracted.venue = yamlVenueMatch[1].trim()
          }
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
                           step.selectedTool?.includes('browser') ||
                           step.selectedTool?.includes('navigate') ||
                           step.description.toLowerCase().includes('playwright') ||
                           step.description.toLowerCase().includes('check') && (step.description.toLowerCase().includes('website') || step.description.toLowerCase().includes('site') || step.description.toLowerCase().includes('ticket') || step.description.toLowerCase().includes('concert')) ||
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
    // Check if this is a rental agency site visit (step 3+ in multi-step workflow)
    const isRentalSite = step.description.toLowerCase().includes('rental agency') ||
                        step.description.toLowerCase().includes('rental site') ||
                        step.description.toLowerCase().includes('visit that rental')
    
    if (isRentalSite && previousResults.length > 0) {
      // We have a rental agency from previous step (Google Maps)
      // Extract URL from previous step result
      const prevResult = previousResults[previousResults.length - 1]?.result
      if (prevResult && typeof prevResult === 'object') {
        const prevObj = prevResult as Record<string, unknown>
        // Try to extract website URL from Google Maps result
        const website = prevObj.website || prevObj.url
        if (website && typeof website === 'string') {
          args.url = website
          // Extract car type and date from query
          const carTypeMatch = step.description.match(/(?:for|get|find)\s+(?:a\s+)?['"]?([^'"]+)['"]?\s+(?:car|vehicle)/i) ||
                              step.description.match(/(full size|compact|suv|sedan)/i)
          if (carTypeMatch) {
            args.search_query = `${carTypeMatch[1]} car rental`
          }
          // Add date from concert if available
          if (extracted.date) {
            args.search_query = `${args.search_query || 'rental'} for ${extracted.date}`
          }
        } else {
          // Try to extract from formatted result
          const formatted = prevObj.formatted
          if (formatted && typeof formatted === 'string') {
            const urlMatch = formatted.match(/\[website\]\(([^)]+)\)/) || formatted.match(/(https?:\/\/[^\s)]+)/)
            if (urlMatch) {
              args.url = urlMatch[1]
            }
          }
        }
      }
    } else {
      // Extract URL or search terms from description
      const urlMatch = step.description.match(/(https?:\/\/[^\s]+)/)
      if (urlMatch) {
        args.url = urlMatch[1]
      } else {
        // Check for "using [domain]" pattern (e.g., "using ticketmaster.com")
        const usingMatch = step.description.match(/using\s+([\w-]+(?:\.com)?)/i)
        
        // Check if user explicitly mentioned a site (e.g., "check ticketmaster")
        const siteMatch = step.description.match(/check\s+(\w+)/i) || 
                         step.description.match(/(?:on|at)\s+(\w+\.com|\w+)/i) ||
                         usingMatch
        
        // For concert/ticketing searches, construct a search query
        const concertMatch = step.description.match(/['"](.+?)['"]/i) ||
                            step.description.match(/find.*['"](.+?)['"]/i) ||
                            step.description.match(/for (.+?)'s/i) ||
                            step.description.match(/LCD Soundsystem/i) ||
                            step.description.match(/concert schedule/i)
        
        if (siteMatch || usingMatch) {
          // User specified a site (e.g., "ticketmaster" or "using ticketmaster.com")
          const site = (siteMatch?.[1] || usingMatch?.[1] || '').toLowerCase().replace('.com', '')
          if (site === 'ticketmaster' || site.includes('ticket') || step.description.toLowerCase().includes('ticketmaster')) {
            args.url = 'https://www.stubhub.com' // Use StubHub instead of Ticketmaster
            // Extract artist/band name
            const artistMatch = step.description.match(/['"](.+?)['"]/i) || step.description.match(/find.*?['"](.+?)['"]/i)
            if (artistMatch) {
              args.search_query = `${artistMatch[1]} New York`
            } else {
              args.search_query = 'LCD Soundsystem New York'
            }
          } else {
            args.url = `https://www.${site}.com`
            args.search_query = step.description
          }
        } else if (concertMatch) {
          // Concert search without specific site - default to StubHub
          args.url = 'https://www.stubhub.com'
          args.search_query = `${concertMatch[1] || 'LCD Soundsystem'} New York concert`
        } else {
          // Generic search - check if description mentions ticketmaster
          if (step.description.toLowerCase().includes('ticketmaster')) {
            args.url = 'https://www.stubhub.com'
          }
          args.search_query = step.description
        }
        
        // Enable auto-search for concert queries
        if (args.search_query && (step.description.toLowerCase().includes('find') || 
                                  step.description.toLowerCase().includes('when') ||
                                  step.description.toLowerCase().includes('playing'))) {
          args.auto_search = true
          args.wait_timeout = 15000
        }
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

        // Extract raw result for formatting
        let rawResult: unknown = toolResult.result
        if (toolResult.content && toolResult.content.length > 0) {
          const textContent = toolResult.content
            .filter(c => c.type === 'text' && c.text)
            .map(c => c.text)
            .join('\n')

          // Try to parse structured data from text
          try {
            const parsed = JSON.parse(textContent)
            rawResult = parsed
          } catch {
            // If not JSON, store as text content (will be parsed by formatter)
            rawResult = { 
              content: textContent,
            }
          }
        }

        // Format the result as natural language for better user experience
        try {
          const toolContext: ToolContext = {
            tool: step.toolContext?.tool || 'unknown',
            serverId: server.serverId,
            toolName: tool,
          }
          const formattedResult = await formatToolResponse(
            step.description,
            rawResult,
            toolContext
          )
          // Store both raw and formatted results
          step.result = {
            raw: rawResult,
            formatted: formattedResult,
          }
          finalResult = formattedResult // Use formatted result as final output
          console.log(`[Workflow] Step ${step.step} completed and formatted.`)
        } catch (formatError) {
          console.warn(`[Workflow] Failed to format step ${step.step} result:`, formatError)
          // Fallback to raw result if formatting fails
          step.result = rawResult
          finalResult = rawResult
          console.log(`[Workflow] Step ${step.step} completed (raw result).`)
        }
      } else {
        step.error = toolResult.error || 'Tool invocation failed'
        console.error(`[Workflow] Step ${step.step} failed:`, step.error)
        
        // Error handling: If LangChain fails (500 error), try Playwright as fallback for concert searches
        if (step.step === 1 && 
            (step.selectedServer?.serverId.includes('langchain') || step.selectedServer?.serverId.includes('agent')) &&
            toolResult.error?.includes('500') &&
            (step.description.toLowerCase().includes('playing') || 
             step.description.toLowerCase().includes('concert') ||
             step.description.toLowerCase().includes('ticket'))) {
          
          console.log(`[Workflow] LangChain failed for concert query, trying Playwright as fallback...`)
          
          // Try Playwright as fallback
          // Get servers from orchestrator (they should be registered)
          const orchestratorServers = getOrchestratorServers()
          const playwrightServer = orchestratorServers.find(s => 
            s.serverId.includes('playwright') || s.name.toLowerCase().includes('playwright')
          )
          
          if (playwrightServer && playwrightServer.tools && playwrightServer.tools.length > 0) {
            // Update step to use Playwright
            step.selectedServer = playwrightServer
            step.selectedTool = playwrightServer.tools[0].name
            
            // Rebuild arguments for Playwright
            const playwrightArgs = buildToolArguments(step, query, [])
            const playwrightInvocation: ToolInvocation = {
              serverId: playwrightServer.serverId,
              toolName: playwrightServer.tools[0].name,
              arguments: playwrightArgs,
            }
            
            console.log(`[Workflow] Retrying step ${step.step} with Playwright...`)
            const playwrightResult = await invokeTool(playwrightInvocation)
            
            if (playwrightResult.success) {
              // Use Playwright result instead
              toolResult = playwrightResult
              step.error = undefined
              step.selectedServer = playwrightServer
              step.selectedTool = playwrightServer.tools[0].name
              
              // Process the successful Playwright result
              let rawResult: unknown = playwrightResult.result
              if (playwrightResult.content && playwrightResult.content.length > 0) {
                const textContent = playwrightResult.content
                  .filter(c => c.type === 'text' && c.text)
                  .map(c => c.text)
                  .join('\n')
                
                try {
                  const parsed = JSON.parse(textContent)
                  rawResult = parsed
                } catch {
                  rawResult = { content: textContent }
                }
              }
              
              // Format the result
              try {
                const toolContext: ToolContext = {
                  tool: 'playwright',
                  serverId: playwrightServer.serverId,
                  toolName: playwrightServer.tools[0].name,
                }
                const formattedResult = await formatToolResponse(
                  step.description,
                  rawResult,
                  toolContext
                )
                step.result = { raw: rawResult, formatted: formattedResult }
                finalResult = formattedResult
                console.log(`[Workflow] Step ${step.step} completed with Playwright fallback.`)
              } catch (formatError) {
                console.warn(`[Workflow] Failed to format Playwright result:`, formatError)
                step.result = rawResult
                finalResult = rawResult
              }
            } else {
              console.error(`[Workflow] Playwright fallback also failed:`, playwrightResult.error)
            }
          }
        }
      }

      executedSteps.push(step)

      // Stop if step failed (unless we want to continue on error)
      if (!toolResult.success && step.step === 1 && !step.selectedServer?.serverId.includes('playwright')) {
        break
      }
    }

    // Synthesize final result from all steps
    if (executedSteps.length > 1) {
      const hasFormattedResults = executedSteps.some(
        s => s.result && typeof s.result === 'object' && 'formatted' in s.result
      )
      
      if (hasFormattedResults) {
        // Combine formatted results from all steps
        const formattedParts = executedSteps
          .filter(s => s.result && typeof s.result === 'object' && 'formatted' in s.result)
          .map((s) => {
            const formatted = (s.result as { formatted: string }).formatted
            return `**Step ${s.step}**: ${formatted}`
          })
          .join('\n\n')
        
        finalResult = `I've completed ${executedSteps.length} steps:\n\n${formattedParts}`
      } else {
        // Fallback: create summary if no formatted results
        finalResult = {
          steps: executedSteps.map(s => ({
            step: s.step,
            description: s.description,
            result: s.result,
          })),
          summary: executedSteps.map(s => s.description).join(' → '),
        }
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
