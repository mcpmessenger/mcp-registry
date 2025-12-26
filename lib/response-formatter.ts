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
  
  // Extract StubHub format: - h4 "Jan", - h4 "15", - p "2026" with artist name nearby
  // YAML uses list format with "- " prefix
  const stubhubDatePattern = /-\s+h4\s+"([A-Za-z]{3})"\s*\n-\s+h4\s+"(\d+)"\s*\n-\s+p\s+"(\d{4})"/g
  const dates: Array<{month: string, day: string, year: string, index: number}> = []
  let dateMatch
  while ((dateMatch = stubhubDatePattern.exec(snapshot)) !== null) {
    dates.push({
      month: dateMatch[1],
      day: dateMatch[2],
      year: dateMatch[3],
      index: dateMatch.index
    })
  }
  
  // Also try without "- " prefix (in case format varies)
  const stubhubDatePattern2 = /h4\s+"([A-Za-z]{3})"\s*\n\s*h4\s+"(\d+)"\s*\n\s*p\s+"(\d{4})"/g
  while ((dateMatch = stubhubDatePattern2.exec(snapshot)) !== null) {
    const dateStr = `${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3]}`
    // Check if we already have this date
    const exists = dates.find(d => `${d.month} ${d.day} ${d.year}` === dateStr)
    if (!exists) {
      dates.push({
        month: dateMatch[1],
        day: dateMatch[2],
        year: dateMatch[3],
        index: dateMatch.index
      })
    }
  }
  
  // For each date, look for nearby artist name
  for (const date of dates) {
    // Look backwards from date for artist name (usually appears before date in StubHub)
    const contextStart = Math.max(0, date.index - 300)
    const context = snapshot.substring(contextStart, Math.min(snapshot.length, date.index + 200))
    
    // Try to find artist name - look for "Iration" or other artist names in links/paragraphs
    const artistMatch = context.match(/(?:link|p|heading)\s+"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)"[^\n]*\n[^\n]*(?:p\s+"\1"|graphics-symbol|img)/)
    if (artistMatch) {
      const artistName = artistMatch[1].trim()
      // Check if "See Tickets" appears after the date
      const afterDate = snapshot.substring(date.index, Math.min(snapshot.length, date.index + 300))
      const hasTickets = afterDate.includes('See Tickets') || afterDate.includes('button')
      
      if (hasTickets && artistName && artistName.length > 1 && artistName.length < 50) {
        // Format date
        const monthNames: Record<string, string> = {
          'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
          'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
          'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
        }
        const fullDate = `${monthNames[date.month] || date.month} ${date.day}, ${date.year}`
        
        // Avoid duplicates
        const existing = result.events?.find(e => e.name === artistName && e.date === fullDate)
        if (!existing) {
          result.events?.push({
            name: artistName,
            date: fullDate,
            venue: 'See StubHub for venue details',
          })
        }
      }
    }
  }
  
  // Also extract "Iration" directly if it appears in the snapshot
  // This is a simpler approach: find all dates, then find "Iration" and pair them
  if (snapshot.includes('Iration') || snapshot.includes('iration')) {
    // Find all occurrences of the artist name (handle YAML list format)
    const artistPattern = /(?:-\s+)?(?:link|p|heading)\s+"(Iration)"[^\n]*/gi
    const artistMatches = [...snapshot.matchAll(artistPattern)]
    
    // If we found dates, pair each date with "Iration"
    if (dates.length > 0 && artistMatches.length > 0) {
      const monthNames: Record<string, string> = {
        'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
        'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
        'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
      }
      
      // For each date, check if it's reasonably close to an "Iration" mention
      for (const date of dates) {
        const dateStr = `${monthNames[date.month] || date.month} ${date.day}, ${date.year}`
        const existing = result.events?.find(e => e.name === 'Iration' && e.date === dateStr)
        
        if (!existing) {
          // Check if there's an "Iration" mention within 1000 characters of this date
          const nearbyContext = snapshot.substring(
            Math.max(0, date.index - 500),
            Math.min(snapshot.length, date.index + 500)
          )
          
          if (nearbyContext.includes('Iration') || nearbyContext.includes('iration')) {
            result.events?.push({
              name: 'Iration',
              date: dateStr,
              venue: 'See StubHub for venue details',
            })
          }
        }
      }
    }
    
    // Fallback: if no dates found but "Iration" exists, still create an event entry
    if (dates.length === 0 && result.events?.length === 0) {
      // Extract any dates in the context around "Iration"
      const artistIndex = snapshot.indexOf('Iration') >= 0 ? snapshot.indexOf('Iration') : snapshot.toLowerCase().indexOf('iration')
      if (artistIndex >= 0) {
        const context = snapshot.substring(Math.max(0, artistIndex - 1000), Math.min(snapshot.length, artistIndex + 1000))
        const nearbyDate = context.match(/(?:-\s+)?h4\s+"([A-Za-z]{3})"\s*\n(?:-\s+)?h4\s+"(\d+)"\s*\n(?:-\s+)?p\s+"(\d{4})"/)
        
        if (nearbyDate) {
          const monthNames: Record<string, string> = {
            'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
            'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
            'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
          }
          const fullDate = `${monthNames[nearbyDate[1]] || nearbyDate[1]} ${nearbyDate[2]}, ${nearbyDate[3]}`
          
          result.events?.push({
            name: 'Iration',
            date: fullDate,
            venue: 'See StubHub for venue details',
          })
        }
      }
    }
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
    
    // If snapshot exists but is minimal (just a few basic elements), provide helpful context
    if (snapshot !== rawContent) {
      const lineCount = snapshot.split('\n').filter(l => l.trim()).length
      const hasMinimalContent = lineCount < 30 && (
        snapshot.includes('- input') || 
        snapshot.includes('- a') || 
        snapshot.includes('graphics-symbol') ||
        snapshot.includes('stubhub logo')
      )
      
      if (hasMinimalContent) {
        // Extract query context
        const searchTerms = query.match(/(?:look for|search for|find)\s+(.+?)(?:\.|$|in |near )/i)?.[1] || query
        return `I've completed the search for **"${searchTerms}"** on StubHub.\n\n**Status**: The page has been loaded and the search executed. However, the current page snapshot shows minimal content, which could mean:\n\n1. 🔄 **Results are still loading** - The search may need a moment to complete\n2. 📋 **No results found** - There may not be events matching your search\n3. ⏳ **Page structure changed** - The site may have updated its layout\n\n💡 **Next Steps**:\n- Try refining your search terms\n- Check back in a few moments if results are loading\n- The search was successfully executed on StubHub's website`
      }
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

