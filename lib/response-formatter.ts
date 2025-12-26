/**
 * Natural Language Response Formatter
 * 
 * Transforms unstructured tool responses (YAML snapshots, JSON data) into
 * natural language answers based on the original user query.
 */

export interface ToolResponse {
  content?: Array<{ type: string; text?: string; data?: string }>
  snapshot?: string
  result?: unknown
}

export interface ToolContext {
  tool: string
  serverId: string
  toolName: string
}

/**
 * Extract structured data from Playwright YAML snapshots
 */
export function parsePlaywrightSnapshot(snapshot: string): {
  events?: Array<{
    name: string
    date?: string
    time?: string
    venue?: string
    url?: string
  }>
  searchResults?: string[]
  links?: Array<{ text: string; url: string }>
} {
  const result: ReturnType<typeof parsePlaywrightSnapshot> = {
    events: [],
    searchResults: [],
    links: [],
  }

  if (!snapshot) return result

  // Extract events from list items (common pattern in ticket sites)
  const eventPattern = /listitem.*?:\s*([^-\n]+)\s*-\s*([A-Za-z]+,\s*[A-Za-z]+\s+\d+)\s*•\s*(\d+:\d+\s*[AP]M)\s*-\s*([^\n]+)/g
  let match
  while ((match = eventPattern.exec(snapshot)) !== null) {
    result.events?.push({
      name: match[1].trim(),
      date: match[2].trim(),
      time: match[3].trim(),
      venue: match[4].trim(),
    })
  }

  // Extract links
  const linkPattern = /link\s+"([^"]+)"\s*\[.*?\]:\s*-?\s*\/url:\s*([^\s\n]+)/g
  while ((match = linkPattern.exec(snapshot)) !== null) {
    const url = match[2].startsWith('http') ? match[2] : `https://www.stubhub.com${match[2]}`
    result.links?.push({
      text: match[1].trim(),
      url: url,
    })
  }

  // Extract headings (often contain search result summaries)
  const headingPattern = /heading\s+"([^"]+)"\s*\[.*?\]/g
  while ((match = headingPattern.exec(snapshot)) !== null) {
    const heading = match[1].trim()
    if (heading.toLowerCase().includes('search') || heading.toLowerCase().includes('result')) {
      result.searchResults?.push(heading)
    }
  }

  // Extract list items that might be search results
  const listItemPattern = /listitem\s+\[ref=[^\]]+\]:\s*-?\s*(.+?)(?:\n|$)/g
  while ((match = listItemPattern.exec(snapshot)) !== null) {
    const item = match[1].trim()
    if (item && !item.match(/^\d+ - /) && item.length > 10) {
      result.searchResults?.push(item)
    }
  }

  return result
}

/**
 * Format structured data as natural language
 */
export function formatAsNaturalLanguage(
  query: string,
  structuredData: ReturnType<typeof parsePlaywrightSnapshot>,
  toolContext: ToolContext
): string {
  // If we have events (concerts, shows, etc.), format them nicely
  if (structuredData.events && structuredData.events.length > 0) {
    const events = structuredData.events
    let response = `I found ${events.length} ${events.length === 1 ? 'event' : 'events'}:\n\n`

    events.forEach((event, index) => {
      response += `${index + 1}. **${event.name}**\n`
      if (event.date) response += `   - Date: ${event.date}`
      if (event.time) response += ` at ${event.time}`
      if (event.venue) response += `\n   - Venue: ${event.venue}`
      if (event.url) response += `\n   - [Get tickets](${event.url})`
      response += `\n\n`
    })

    return response.trim()
  }

  // If we have search results
  if (structuredData.searchResults && structuredData.searchResults.length > 0) {
    const results = structuredData.searchResults.slice(0, 10) // Limit to top 10
    let response = `I found ${results.length} result${results.length === 1 ? '' : 's'}:\n\n`

    results.forEach((result, index) => {
      response += `${index + 1}. ${result}\n`
    })

    return response.trim()
  }

  // If we have links
  if (structuredData.links && structuredData.links.length > 0) {
    const links = structuredData.links.slice(0, 10)
    let response = `I found ${links.length} relevant link${links.length === 1 ? '' : 's'}:\n\n`

    links.forEach((link, index) => {
      response += `${index + 1}. [${link.text}](${link.url})\n`
    })

    return response.trim()
  }

  // Fallback: return a summary
  return `I've completed the search. Review the results above for details.`
}

/**
 * Format tool response using LLM (when available)
 * Falls back to structured parsing if LLM is not available
 */
export async function formatResponseWithLLM(
  query: string,
  response: ToolResponse,
  toolContext: ToolContext
): Promise<string> {
  // Extract snapshot or text content
  let rawContent = ''
  if (response.snapshot) {
    rawContent = response.snapshot
  } else if (response.content) {
    rawContent = response.content
      .filter(item => item.type === 'text' && item.text)
      .map(item => item.text)
      .join('\n\n')
  } else if (typeof response.result === 'string') {
    rawContent = response.result
  } else {
    rawContent = JSON.stringify(response.result, null, 2)
  }

  // For Playwright responses, try structured parsing first
  if (toolContext.tool === 'playwright' || toolContext.serverId.includes('playwright')) {
    // Extract YAML snapshot if present
    let snapshot = rawContent
    if (rawContent.includes('```yaml')) {
      const yamlMatch = rawContent.match(/```yaml\n([\s\S]*?)\n```/)
      snapshot = yamlMatch ? yamlMatch[1] : rawContent
    } else if (rawContent.includes('Page Snapshot')) {
      // Extract content after "Page Snapshot:"
      const snapshotMatch = rawContent.match(/Page Snapshot:\s*```yaml\n([\s\S]*?)\n```/i)
      snapshot = snapshotMatch ? snapshotMatch[1] : rawContent
    }

    // Parse and format the snapshot
    const structured = parsePlaywrightSnapshot(snapshot)
    
    // If we found structured data, format it
    if (structured.events?.length || structured.searchResults?.length || structured.links?.length) {
      return formatAsNaturalLanguage(query, structured, toolContext)
    }
    
    // If snapshot exists but no structured data found, provide a summary
    if (snapshot !== rawContent && snapshot.length > 100) {
      return `I've completed the search. The page has been loaded and analyzed. ${structured.events?.length ? `Found ${structured.events.length} events.` : structured.links?.length ? `Found ${structured.links.length} links.` : 'Review the page snapshot above for details.'}`
    }
  }

  // TODO: Add LLM-based formatting here when LLM API is available
  // For now, return structured parsing result or fallback
  return formatAsNaturalLanguage(query, parsePlaywrightSnapshot(rawContent), toolContext)
}

/**
 * Main formatter function
 */
export async function formatToolResponse(
  query: string,
  toolResponse: unknown,
  toolContext: ToolContext
): Promise<string> {
  try {
    // Convert response to standard format
    const response: ToolResponse = 
      typeof toolResponse === 'object' && toolResponse !== null
        ? (toolResponse as ToolResponse)
        : { result: toolResponse }

    // Format using appropriate method
    return await formatResponseWithLLM(query, response, toolContext)
  } catch (error) {
    console.error('[ResponseFormatter] Error formatting response:', error)
    // Fallback to raw response if formatting fails
    return typeof toolResponse === 'string'
      ? toolResponse
      : JSON.stringify(toolResponse, null, 2)
  }
}

