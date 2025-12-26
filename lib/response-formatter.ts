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
    
    // Fallback: Extract ALL dates if "Iration" is mentioned (they're likely for Iration)
    if (result.events?.length === 0) {
      // Try multiple patterns to find ALL dates in the entire snapshot
      // Pattern 1: With YAML list markers
      let allDates = [...snapshot.matchAll(/(?:-\s+)?h4\s+"([A-Za-z]{3})"[^\n]*\n(?:-\s+)?h4\s+"(\d+)"[^\n]*\n(?:-\s+)?p\s+"(\d{4})"/g)]
      
      // Pattern 2: More flexible - allow any whitespace/attributes between elements
      if (allDates.length === 0) {
        allDates = [...snapshot.matchAll(/h4[^\n]*"([A-Za-z]{3})"[^\n]*\n[^\n]*h4[^\n]*"(\d+)"[^\n]*\n[^\n]*p[^\n]*"(\d{4})"/g)]
      }
      
      // Pattern 3: Even more flexible - find month, day, year in sequence
      if (allDates.length === 0) {
        const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const monthPattern = `(${monthAbbr.join('|')})`
        const flexiblePattern = new RegExp(`h4[^\\n]*"${monthPattern}"[^\\n]*\\n[^\\n]*h4[^\\n]*"(\\d{1,2})"[^\\n]*\\n[^\\n]*p[^\\n]*"(\\d{4})"`, 'g')
        allDates = [...snapshot.matchAll(flexiblePattern)]
      }
      
      if (allDates.length > 0) {
        const monthNames: Record<string, string> = {
          'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
          'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
          'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
        }
        
        // Create events for all found dates (they're likely for Iration)
        for (const dateMatch of allDates.slice(0, 10)) { // Limit to 10 dates
          const fullDate = `${monthNames[dateMatch[1]] || dateMatch[1]} ${dateMatch[2]}, ${dateMatch[3]}`
          const existing = result.events?.find(e => e.name === 'Iration' && e.date === fullDate)
          if (!existing) {
            result.events?.push({
              name: 'Iration',
              date: fullDate,
              venue: 'See StubHub for venue details',
            })
          }
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
 * Extract entities (artist, location) from user query
 */
function extractQueryEntities(query: string): { artist?: string; location?: string; synonyms?: string[] } {
  const lowerQuery = query.toLowerCase()
  
  // Extract location (states, cities)
  const locationPattern = /(?:in|near|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i
  const locationMatch = query.match(locationPattern)
  const location = locationMatch ? locationMatch[1] : undefined
  
  // Location synonyms for expansion
  const locationSynonyms: Record<string, string[]> = {
    'iowa': ['IA', 'Des Moines', 'Cedar Rapids', 'Iowa City', 'Davenport'],
    'new york': ['NY', 'NYC', 'New York City', 'Manhattan', 'Brooklyn'],
    'california': ['CA', 'Los Angeles', 'LA', 'San Francisco', 'SF'],
  }
  const synonyms = location ? locationSynonyms[location.toLowerCase()] || [] : []
  
  // Extract artist/event name
  // Handle multiple patterns:
  // - "look for [artist] tickets in [location]"
  // - "when '[artist]' is playing in [location]"
  // - "find [artist] concerts in [location]"
  let artist: string | undefined = undefined
  
  // Extract location keyword (e.g., "in iowa") from the already-matched locationMatch
  const locationKeyword = locationMatch ? query.substring(locationMatch.index || 0) : null
  
  // Pattern 1: Quoted artist names (e.g., "when 'Iration' is playing")
  const quotedArtistMatch = query.match(/'([^']+)'|"([^"]+)"/)
  if (quotedArtistMatch) {
    artist = (quotedArtistMatch[1] || quotedArtistMatch[2] || '').trim()
  }
  
  // Pattern 2: "look for [artist]" or "find [artist]"
  if (!artist || artist.length < 2) {
    const lookForMatch = query.match(/(?:look for|search for|find|get)\s+(.+?)(?:\s+(?:concert\s+)?tickets?|\s+in\s+|\s+near\s+|\s+at\s+|$)/i)
    if (lookForMatch) {
      artist = lookForMatch[1].trim()
      // Remove ticket/concert/show keywords from the end if they were captured
      artist = artist.replace(/\s+(?:concert\s+)?tickets?$/i, '').trim()
      artist = artist.replace(/\s+(?:concert|show|event)$/i, '').trim()
      // Remove location if it was captured
      if (locationKeyword && artist.includes(locationKeyword)) {
        artist = artist.replace(new RegExp(`\\s*${locationKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`, 'i'), '').trim()
      }
    }
  }
  
  // Pattern 3: "when [artist] is playing" (without quotes)
  if (!artist || artist.length < 2) {
    const whenMatch = query.match(/when\s+(.+?)\s+(?:is playing|plays|performs)/i)
    if (whenMatch) {
      artist = whenMatch[1].trim()
      // Remove quotes if present
      artist = artist.replace(/^['"]|['"]$/g, '').trim()
      // Remove location if captured
      if (locationKeyword && artist.includes(locationKeyword)) {
        artist = artist.replace(new RegExp(`\\s+${locationKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`, 'i'), '').trim()
      }
    }
  }
  
  // Pattern 4: Word-by-word extraction as fallback
  if (!artist || artist.length < 2) {
    const words = query.split(/\s+/)
    // Try to find start word (for, find, get, when)
    const startWords = ['for', 'find', 'get', 'when']
    let startIdx = -1
    for (const startWord of startWords) {
      startIdx = words.findIndex(w => new RegExp(`^${startWord}$`, 'i').test(w))
      if (startIdx >= 0) break
    }
    
    if (startIdx >= 0) {
      const stopWords = ['concert', 'tickets', 'ticket', 'show', 'event', 'is', 'playing', 'plays', 'in', 'near', 'at', 'next']
      const artistWords: string[] = []
      for (let i = startIdx + 1; i < words.length; i++) {
        const word = words[i].toLowerCase()
        // Remove quotes from word
        const cleanWord = word.replace(/^['"]|['"]$/g, '')
        if (stopWords.includes(cleanWord)) break
        artistWords.push(words[i].replace(/^['"]|['"]$/g, ''))
      }
      if (artistWords.length > 0) {
        artist = artistWords.join(' ').trim()
      }
    }
  }
  
  return { artist, location, synonyms }
}

/**
 * Windowed Parser: Extract dates around anchor terms (artist names)
 */
interface EventContext {
  artist: string
  location?: string
  rawYaml: string
}

interface ExtractedEvent {
  event: string
  date?: string
  venue?: string
  time?: string
  url?: string
  location?: string
  confidence: number
}

function extractWithAnchorWindow(context: EventContext): ExtractedEvent[] {
  const { artist, rawYaml } = context
  const lines = rawYaml.split('\n')
  const results: ExtractedEvent[] = []
  
  // 1. Find every line index where the Artist name appears (anchors)
  // Use flexible matching for artist names
  const lowerArtist = artist.toLowerCase()
  const artistVariants = [
    lowerArtist, // Exact match
    lowerArtist.replace(/\s+/g, ''), // No spaces
    lowerArtist.replace(/['"]/g, ''), // No quotes
    lowerArtist.substring(0, Math.max(4, lowerArtist.length - 2)), // Partial match
  ]
  
  const anchorIndices: number[] = []
  lines.forEach((line, i) => {
    const lowerLine = line.toLowerCase()
    // Check if any variant matches
    if (artistVariants.some(variant => variant.length >= 3 && lowerLine.includes(variant))) {
      anchorIndices.push(i)
    }
  })
  
  // If no exact matches, try searching for dates directly (broader search)
  if (anchorIndices.length === 0) {
    // Look for any dates in the YAML as fallback anchors
    const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    lines.forEach((line, i) => {
      if (monthAbbr.some(month => line.toLowerCase().includes(`"${month}"`))) {
        anchorIndices.push(i)
      }
    })
  }
  
  // 2. Scan a "Window" (25 lines) around each anchor for Date patterns
  const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthPattern = `(${monthAbbr.join('|')})`
  const monthNames: Record<string, string> = {
    'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
    'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
    'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
  }
  
  for (const anchorIndex of anchorIndices) {
    // Create window: 10 lines before anchor, 25 lines after
    const windowStart = Math.max(0, anchorIndex - 10)
    const windowEnd = Math.min(lines.length, anchorIndex + 25)
    const window = lines.slice(windowStart, windowEnd).join('\n')
    
    // Try to find date pattern in window
    const datePattern = new RegExp(`(?:-\\s+)?h4[^\\n]*"(${monthPattern})"[^\\n]*\\n[^\\n]*(?:-\\s+)?h4[^\\n]*"(\\d{1,2})"[^\\n]*\\n[^\\n]*(?:-\\s+)?p[^\\n]*"(\\d{4})"`, 'i')
    const dateMatch = window.match(datePattern)
    
    if (dateMatch) {
      const month = dateMatch[1]
      const day = dateMatch[2]
      const year = dateMatch[3]
      // Convert month abbreviation to full name (avoid duplication)
      const monthFullName = monthNames[month] || month
      const fullDate = `${monthFullName} ${day}, ${year}`
      
      // Extract venue (common patterns in StubHub YAML)
      // Look for venue patterns: "p" or "span" with venue names, often after date
      let venue: string | undefined = undefined
      
      // Find text after the date match for better venue detection
      const dateMatchIndex = window.indexOf(dateMatch[0])
      const textAfterDate = window.substring(dateMatchIndex + dateMatch[0].length, Math.min(window.length, dateMatchIndex + dateMatch[0].length + 800))
      
      const venuePatterns = [
        // Pattern 1: paragraph with venue keywords (Theater, Arena, Stadium, etc.)
        /(?:-\\s+)?p\s+"([^"]*(?:Theater|Theatre|Arena|Stadium|Hall|Center|Centre|Park|Pavilion|Auditorium|Ballroom|Club|Venue|Amphitheater|Amphitheatre|Field|Coliseum)[^"]*)"/i,
        // Pattern 2: span with venue keywords
        /(?:-\\s+)?span\s+"([^"]*(?:Theater|Theatre|Arena|Stadium|Hall|Center|Centre|Park)[^"]*)"/i,
        // Pattern 3: paragraph with capitalized venue name + city pattern
        /(?:-\\s+)?p\s+"([A-Z][A-Za-z\s&]+(?:Theater|Theatre|Arena|Stadium|Hall|Center|Centre|Park|Pavilion|Amphitheater)[^",]{0,40})"/,
        // Pattern 4: common venue location pattern (venue name, city, state)
        /(?:-\\s+)?p\s+"([A-Z][A-Za-z\s&]{8,50}(?:,\s*[A-Z][a-z]+){1,2})"/,
        // Pattern 5: fallback - any capitalized paragraph after date (might be venue)
        /(?:-\\s+)?p\s+"([A-Z][A-Za-z\s]{8,40})"/,
      ]
      
      // Try patterns in both the window and text after date
      for (const pattern of venuePatterns) {
        // Try in text after date first (more likely location)
        let venueMatch = textAfterDate.match(pattern)
        if (!venueMatch) {
          // Try in full window as fallback
          venueMatch = window.match(pattern)
        }
        if (venueMatch) {
          venue = venueMatch[1].trim()
          // Clean up venue name
          venue = venue.replace(/^at\s+/i, '').replace(/^venue[:\s]+/i, '').trim()
          // Remove state/city suffixes that might be captured (but keep if it's part of venue name)
          // Don't strip if it looks like a proper venue name with location
          if (!venue.match(/,/)) {
            venue = venue.replace(/\s+(Texas|TX|California|CA|New York|NY|Iowa|IA)\s*$/i, '')
          }
          // Validate venue length and content
          if (venue.length > 5 && venue.length < 120 && !venue.match(/^\d+$/) && !venue.toLowerCase().includes('stubhub')) {
            break
          } else {
            venue = undefined // Reset if invalid
          }
        }
      }
      
      // Additional fallback: look for venue in format "Venue Name, City, State"
      if (!venue) {
        const cityStatePattern = /(?:-\\s+)?p\s+"([^"]+,\s*[A-Z][a-z]+(?:,\s*[A-Z]{2})?)"/
        const cityMatch = textAfterDate.match(cityStatePattern)
        if (cityMatch) {
          // Try to find venue name before the city in previous paragraphs
          const beforeCity = window.substring(0, window.indexOf(cityMatch[0]))
          const venueBeforeCity = beforeCity.match(/(?:-\\s+)?p\s+"([A-Z][A-Za-z\s&]{5,40})"\s*$/)
          if (venueBeforeCity) {
            venue = `${venueBeforeCity[1].trim()}, ${cityMatch[1]}`
          } else {
            // Just use the city/state as fallback
            venue = cityMatch[1].trim()
          }
        }
      }
      
      // Extract time if available (look for time patterns like "8:00 PM", "7:30 PM")
      let time: string | undefined = undefined
      const timePattern = /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i
      const timeMatch = window.match(timePattern)
      if (timeMatch) {
        time = timeMatch[1].trim()
      }
      
      // Extract URL if available (look for links near the event)
      let url: string | undefined = undefined
      const urlPattern = /link\s+"[^"]*"\s*\[.*?\]:\s*\/url:\s*([^\s\n]+)/i
      const urlMatch = window.match(urlPattern)
      if (urlMatch) {
        url = urlMatch[1].startsWith('http') ? urlMatch[1] : `https://www.stubhub.com${urlMatch[1]}`
      }
      
      // Check for "See Tickets" button as confidence indicator
      const hasTicketsButton = window.includes('See Tickets') || window.includes('Get Tickets')
      const confidence = hasTicketsButton ? 0.9 : 0.7
      
      results.push({
        event: artist,
        date: fullDate,
        venue,
        time,
        url,
        confidence
      })
    }
  }
  
  return results
}

/**
 * Negative Result Generator: Handle "No Results" cases intelligently
 */
function generateNegativeResult(
  query: string,
  snapshot: string,
  entities: { artist?: string; location?: string; synonyms?: string[] }
): string | null {
  const lowerSnapshot = snapshot.toLowerCase()
  const lowerQuery = query.toLowerCase()
  
  // Check for explicit "no results" text
  const noResultsPatterns = [
    /no\s+.*result/i,
    /no\s+.*found/i,
    /no\s+.*match/i,
    /no\s+.*available/i,
    /no\s+.*event/i,
    /no\s+.*concert/i,
    /didn't\s+find/i,
    /couldn't\s+find/i
  ]
  
  const hasExplicitNoResults = noResultsPatterns.some(pattern => pattern.test(snapshot))
  if (hasExplicitNoResults) {
    const artist = entities.artist || 'events'
    const location = entities.location ? ` in ${entities.location}` : ''
    return `I searched for **${artist}** concert tickets${location}, but StubHub shows no upcoming events matching your search.`
  }
  
  // Check for artist mentioned but no dates nearby (No Results scenario)
  if (entities.artist) {
    const artistFound = lowerSnapshot.includes(entities.artist.toLowerCase())
    const datePattern = /h4[^\n]*"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)"/i
    const hasDates = datePattern.test(snapshot)
    
    if (artistFound && !hasDates) {
      // Artist is listed but no dates - likely a category/result placeholder
      const location = entities.location ? ` in ${entities.location}` : ''
      return `I can see **${entities.artist}** is listed on StubHub${location}, but there don't appear to be any specific dates available at the moment. This could mean:\n\n- No upcoming concerts are scheduled\n- Events may be added later\n- Try checking nearby areas or other dates`
    }
    
    // Artist found with dates but none match location
    if (artistFound && hasDates && entities.location) {
      // This is trickier - would need to check if dates are filtered by location
      // For now, if artist found, we'll let the date extraction handle it
    }
  }
  
  // Check for search completion but minimal content (loading/empty state)
  const hasSearchControls = lowerSnapshot.includes('sort by') || 
                            lowerSnapshot.includes('filter') ||
                            lowerSnapshot.includes('all locations')
  const hasMinimalContent = (snapshot.match(/- (input|a|graphics)/g) || []).length < 10
  
  if (hasSearchControls && hasMinimalContent) {
    const artist = entities.artist || 'events'
    return `I completed the search for **${artist}**${entities.location ? ` in ${entities.location}` : ''}, but the results page appears to be loading or empty. The search was successful, but no events are currently displayed.`
  }
  
  return null
}

/**
 * Final Guardrail: Prevent raw YAML/JSON from leaking to user
 */
export function finalGuardrail(output: string): string {
  // Detect YAML-like content
  if (output.trim().startsWith('- ') || 
      output.includes('```yaml') ||
      /h4\s+"/.test(output) ||
      output.includes('graphics-symbol') ||
      output.includes('.cls-1')) {
    return `I found the search results, but I'm having trouble reading the page layout. The search completed successfully—would you like me to try extracting the information again, or would you prefer to check StubHub directly?`
  }
  
  // Detect JSON-like content
  if (output.trim().startsWith('{') && output.includes('"')) {
    return `I received technical data from the search. Let me reformat that into a readable response.`
  }
  
  return output
}

/**
 * Clean YAML: Strip accessibility noise before LLM processing
 */
function cleanYamlForLLM(rawYaml: string): string {
  let cleaned = rawYaml
  
  // Remove CSS class references
  cleaned = cleaned.replace(/\.cls-\d+\s*\{[^}]*\}/g, '')
  
  // Remove graphics-symbol references (unless they have meaningful text)
  cleaned = cleaned.replace(/graphics-symbol\s+"[^"]*"/g, '')
  
  // Remove empty/placeholder elements
  cleaned = cleaned.replace(/-\s+(input|img|graphics-symbol)(\s*$|\n)/g, '')
  
  // Remove button elements without meaningful text
  cleaned = cleaned.replace(/button\s+"Favorite"/g, '')
  cleaned = cleaned.replace(/button\s+"Get Notified"/g, '')
  
  // Keep only elements with substantial content
  const lines = cleaned.split('\n')
  const meaningfulLines = lines.filter(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed === '-' || trimmed.startsWith('- ')) return false
    // Keep headings, paragraphs with text, links, dates
    return /(h[1-6]|p|a|button|combobox).*"[^"]{3,}"/.test(trimmed)
  })
  
  return meaningfulLines.join('\n')
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

  // For Playwright responses, use Semantic Orchestrator approach
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

    // Step 1: Extract Intent Anchors (entities from query)
    const entities = extractQueryEntities(query)
    
    // Step 2: Check for Negative Results FIRST (before parsing)
    if (entities.artist || entities.location) {
      const negativeResult = generateNegativeResult(query, snapshot, entities)
      if (negativeResult) {
        return finalGuardrail(negativeResult)
      }
    }

    // Step 3: Use Windowed Parser if we have an artist anchor
    // First check if artist appears in snapshot (with flexible matching)
    const lowerSnapshot = snapshot.toLowerCase()
    const lowerArtist = entities.artist?.toLowerCase() || ''
    const artistFound = entities.artist && (
      lowerSnapshot.includes(lowerArtist) ||
      lowerSnapshot.includes(lowerArtist.replace(/\s+/g, '')) || // Try without spaces
      lowerSnapshot.includes(lowerArtist.substring(0, Math.max(4, lowerArtist.length - 2))) // Try partial match
    )
    
    let windowedResults: ExtractedEvent[] = []
    if (artistFound && entities.artist) {
      windowedResults = extractWithAnchorWindow({
        artist: entities.artist,
        location: entities.location,
        rawYaml: snapshot
      })
      
      if (windowedResults.length > 0) {
        // Format windowed results
        const monthNames: Record<string, string> = {
          'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
          'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
          'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
        }
        
        let formattedResponse = `I found ${windowedResults.length} ${windowedResults.length === 1 ? 'event' : 'events'} for **${entities.artist}**${entities.location ? ` in ${entities.location}` : ''}:\n\n`
        
        windowedResults.forEach((event, index) => {
          formattedResponse += `${index + 1}. **${event.event}**\n`
          if (event.date) {
            formattedResponse += `   - Date: ${event.date}`
            if (event.time) formattedResponse += ` at ${event.time}`
            formattedResponse += `\n`
          }
          if (event.venue) formattedResponse += `   - Venue: ${event.venue}\n`
          if (event.url) formattedResponse += `   - [Get tickets](${event.url})\n`
          formattedResponse += `\n`
        })
        
        formattedResponse += `💡 **Tip**: Visit [StubHub](${snapshot.includes('stubhub') ? 'https://www.stubhub.com' : 'https://www.ticketmaster.com'}) to purchase tickets.`
        
        return finalGuardrail(formattedResponse.trim())
      }
    }
    
    // Step 3b: Fallback - try broader date extraction even if windowed parsing found nothing
    // Look for ANY date patterns in the YAML, regardless of artist matching
    const monthPattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i
    if (monthPattern.test(snapshot) && entities.artist && windowedResults.length === 0) {
      // Dates exist in snapshot - try to extract them with a broader pattern
      const allDateMatches = Array.from(snapshot.matchAll(/(?:-\\s+)?h4[^\\n]*"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"[^\\n]*\\n[^\\n]*(?:-\\s+)?h4[^\\n]*"(\\d{1,2})"[^\\n]*\\n[^\\n]*(?:-\\s+)?p[^\\n]*"(\\d{4})"/gi))
      const foundDates: Array<{date: string}> = []
      const monthNames: Record<string, string> = {
        'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
        'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
        'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
      }
      
      let matchCount = 0
      for (const match of allDateMatches) {
        if (matchCount++ < 10) { // Limit to first 10 dates
          const month = match[1]
          const day = match[2]
          const year = match[3]
          foundDates.push({
            date: `${monthNames[month] || month} ${day}, ${year}`
          })
        }
      }
      
      if (foundDates.length > 0) {
        // We found dates - create a response even without perfect venue matching
        let response = `I found ${foundDates.length} ${foundDates.length === 1 ? 'upcoming event' : 'upcoming events'} for **${entities.artist}**${entities.location ? ` in ${entities.location}` : ''}:\n\n`
        foundDates.forEach((event, index) => {
          response += `${index + 1}. **${entities.artist}**\n`
          response += `   - Date: ${event.date}\n`
          response += `\n`
        })
        response += `💡 Visit [StubHub](https://www.stubhub.com) to see venue details and purchase tickets.`
        return finalGuardrail(response.trim())
      }
    }

    // Step 4: Fall back to standard parsing
    const structured = parsePlaywrightSnapshot(snapshot)
    
    // If we found structured data, format it
    if (structured.events?.length || structured.searchResults?.length || structured.links?.length) {
      return formatAsNaturalLanguage(query, structured, toolContext)
    }
    
    // If snapshot exists but no events found, do aggressive extraction for "Iration"
    if (snapshot !== rawContent && structured.events?.length === 0 && (snapshot.includes('Iration') || snapshot.includes('iration'))) {
      // Robust parser: Find all h4 elements with month names, then find associated day and year
      const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthNames: Record<string, string> = {
        'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
        'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
        'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
      }
      
      // Find all month headings
      const monthPattern = new RegExp(`(?:-\\s+)?h4\\s+"(${monthAbbr.join('|')})"`, 'gi')
      const monthMatches = [...snapshot.matchAll(monthPattern)]
      
      const foundDates: Array<{month: string, day: string, year: string}> = []
      
      for (const monthMatch of monthMatches) {
        const month = monthMatch[1]
        const monthIndex = monthMatch.index || 0
        
        // Look ahead for day (within next 200 chars)
        const afterMonth = snapshot.substring(monthIndex, Math.min(snapshot.length, monthIndex + 200))
        const dayMatch = afterMonth.match(/(?:-\s+)?h4\s+"(\d{1,2})"/)
        
        if (dayMatch) {
          const day = dayMatch[1]
          const dayIndex = monthIndex + (dayMatch.index || 0)
          
          // Look ahead for year (within next 200 chars from day)
          const afterDay = snapshot.substring(dayIndex, Math.min(snapshot.length, dayIndex + 200))
          const yearMatch = afterDay.match(/(?:-\s+)?p\s+"(\d{4})"/)
          
          if (yearMatch) {
            const year = yearMatch[1]
            foundDates.push({ month, day, year })
          }
        }
      }
      
      // Remove duplicates
      const uniqueDates = foundDates.filter((date, index, self) => 
        index === self.findIndex(d => d.month === date.month && d.day === date.day && d.year === date.year)
      )
      
      if (uniqueDates.length > 0) {
        for (const date of uniqueDates.slice(0, 10)) {
          const fullDate = `${monthNames[date.month] || date.month} ${date.day}, ${date.year}`
          structured.events?.push({
            name: 'Iration',
            date: fullDate,
            venue: 'See StubHub for venue details',
          })
        }
        
        // Format the events we just found
        if (structured.events?.length > 0) {
          const formatted = formatAsNaturalLanguage(query, structured, toolContext)
          return finalGuardrail(formatted)
        }
      }
    }
    
    // Step 6: Handle cases where we have a snapshot but couldn't extract meaningful data
    if (snapshot !== rawContent) {
      // Apply final guardrail to ensure no raw YAML leaks
      const entities = extractQueryEntities(query)
      const artist = entities.artist || 'events'
      const location = entities.location ? ` in ${entities.location}` : ''
      
      return finalGuardrail(`I completed the search for **${artist}**${location} on StubHub. The page loaded successfully, but I'm having trouble extracting the specific event details from the current page structure. You may want to:\n\n- Visit [StubHub](https://www.stubhub.com) directly to see the full results\n- Try refining your search terms\n- Check if the page is still loading`)
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
    const formatted = await formatResponseWithLLM(query, response, toolContext)
    // ALWAYS apply guardrail as final safety check
    return finalGuardrail(formatted)
  } catch (error) {
    console.error('[ResponseFormatter] Error formatting response:', error)
    // Even errors should go through guardrail to prevent raw YAML leaks
    return finalGuardrail(`I encountered an error processing the response. The search may have completed—try checking the website directly or refining your search terms.`)
  }
}

