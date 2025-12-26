/**
 * Tool Router
 * 
 * Routes user requests to appropriate MCP tools based on
 * core responsibilities and output contexts
 */

import type { MCPServer } from './api'
import { TOOL_CONTEXTS, getToolContext, findToolsByOutputContext, findToolsByResponsibility } from '@/types/tool-context'

export interface RoutingIntent {
  needs: string[]
  preferredTool?: string
  requiresOrchestration?: boolean
}

/**
 * Analyze user request to determine routing intent
 */
export function analyzeRoutingIntent(content: string): RoutingIntent {
  const lowerContent = content.toLowerCase()
  const needs: string[] = []
  let preferredTool: string | undefined
  let requiresOrchestration = false

  // Check for location-related needs
  if (
    lowerContent.includes('location') ||
    lowerContent.includes('place') ||
    lowerContent.includes('coordinates') ||
    lowerContent.includes('neighborhood') ||
    lowerContent.includes('vibe') ||
    lowerContent.includes('address') ||
    lowerContent.includes('map')
  ) {
    needs.push('Place IDs, Coordinates, Neighborhood Vibe')
    if (!preferredTool) preferredTool = 'google-maps'
  }

  // Check for real-time extraction needs
  const hasWebsiteCheck = lowerContent.includes('check') && (lowerContent.includes('website') || lowerContent.includes('site') || lowerContent.includes('ticket') || lowerContent.includes('concert'))
  const hasUsingDomain = lowerContent.includes('using') && (lowerContent.includes('.com') || lowerContent.includes('ticketmaster') || lowerContent.includes('website'))
  const hasFindUsing = /find.*using/i.test(lowerContent) && (lowerContent.includes('.com') || lowerContent.includes('ticketmaster'))
  const hasGoToWebsite = /go\s+to\s+[\w-]+(?:\.com|\.org|\.net)/i.test(content) ||
                         /navigate\s+to\s+[\w-]+(?:\.com|\.org|\.net)/i.test(content) ||
                         (lowerContent.includes('go to') && (lowerContent.includes('.com') || lowerContent.includes('ticketmaster'))) ||
                         (lowerContent.includes('navigate') && (lowerContent.includes('.com') || lowerContent.includes('website')))
  
  // Check for concert/ticket/event searches (should use Playwright)
  const isConcertSearch = lowerContent.includes('playing') ||
                         lowerContent.includes('concert') ||
                         lowerContent.includes('event') ||
                         lowerContent.includes('ticket') ||
                         (lowerContent.includes('when') && (lowerContent.includes('playing') || lowerContent.includes('performs'))) ||
                         (lowerContent.includes('find') && (lowerContent.includes('concert') || lowerContent.includes('playing')))
  
  if (
    lowerContent.includes('price') ||
    lowerContent.includes('live') ||
    lowerContent.includes('current') ||
    lowerContent.includes('extract') ||
    lowerContent.includes('scrape') ||
    lowerContent.includes('contact') ||
    lowerContent.includes('phone') ||
    lowerContent.includes('email') ||
    lowerContent.includes('terms') ||
    lowerContent.includes('rules') ||
    hasWebsiteCheck ||
    hasUsingDomain ||
    hasFindUsing ||
    hasGoToWebsite ||
    isConcertSearch ||
    lowerContent.includes('playwright') ||
    lowerContent.includes('browser') ||
    lowerContent.includes('navigate') ||
    lowerContent.includes('look for')
  ) {
    needs.push('Live Prices, Hidden Rules, Contact Details')
    // Prefer Playwright for concert searches, even if it's part of a multi-step query
    if (!preferredTool || isConcertSearch) preferredTool = 'playwright'
  }

  // Check for news/search needs
  if (
    lowerContent.includes('news') ||
    lowerContent.includes('trend') ||
    lowerContent.includes('alert') ||
    lowerContent.includes('sentiment') ||
    lowerContent.includes('search') ||
    lowerContent.includes('latest')
  ) {
    needs.push('Trends, Alerts, Sentiment')
    if (!preferredTool) preferredTool = 'search'
  }

  // Check for orchestration needs (multiple tools or complex synthesis)
  // Multi-step queries (e.g., "find X, then find Y", "once you have X, use Y to find Z")
  const multiStepIndicators = [
    'once you',
    'then',
    'after',
    'next',
    'and then',
    'followed by',
    'use that to',
    'use it to',
    'with that',
    'please check',
    'check.*then',
    'check.*and.*find',
  ]
  
  const hasMultiStep = multiStepIndicators.some(indicator => {
    if (indicator.includes('.*')) {
      // Regex pattern
      const regex = new RegExp(indicator, 'i')
      return regex.test(lowerContent)
    }
    return lowerContent.includes(indicator)
  })
  
  // Don't require orchestration for simple website checks - those should use Playwright directly
  const isSimpleWebsiteCheck = (hasWebsiteCheck || hasUsingDomain || hasFindUsing) && !hasMultiStep && needs.length === 1
  
  if (
    (needs.length > 1 || hasMultiStep) && !isSimpleWebsiteCheck ||
    lowerContent.includes('synthesize') ||
    lowerContent.includes('combine') ||
    lowerContent.includes('report') ||
    lowerContent.includes('calculate') ||
    lowerContent.includes('analyze') ||
    lowerContent.includes('compare')
  ) {
    requiresOrchestration = true
    // Only prefer LangChain if it's truly a multi-step query, not a simple website check
    if (!isSimpleWebsiteCheck) {
      preferredTool = 'langchain'
    }
  }

  return { needs, preferredTool, requiresOrchestration }
}

/**
 * Find the best matching server for a routing intent
 */
export function findBestServerForIntent(
  intent: RoutingIntent,
  availableServers: MCPServer[]
): MCPServer | null {
  if (!intent.preferredTool) {
    // If no preferred tool, try to find by output context
    for (const need of intent.needs) {
      const matchingTools = findToolsByOutputContext(need)
      for (const toolContext of matchingTools) {
        const server = availableServers.find(s =>
          s.serverId.toLowerCase().includes(toolContext.tool.toLowerCase()) ||
          s.name.toLowerCase().includes(toolContext.tool.toLowerCase())
        )
        if (server) return server
      }
    }
    return null
  }

  // Find server matching preferred tool
  const toolContext = getToolContext(intent.preferredTool)
  if (!toolContext) {
    // Fallback: search by name
    return availableServers.find(s =>
      s.serverId.toLowerCase().includes(intent.preferredTool!.toLowerCase()) ||
      s.name.toLowerCase().includes(intent.preferredTool!.toLowerCase())
    ) || null
  }

  // Try exact match first
  let server = availableServers.find(s =>
    s.serverId.toLowerCase() === toolContext.tool.toLowerCase() ||
    s.name.toLowerCase() === toolContext.tool.toLowerCase()
  )

  // Try partial match
  if (!server) {
    server = availableServers.find(s =>
      s.serverId.toLowerCase().includes(toolContext.tool.toLowerCase()) ||
      s.name.toLowerCase().includes(toolContext.tool.toLowerCase())
    )
  }

  return server || null
}

/**
 * Route a user request to appropriate server(s)
 */
export function routeRequest(
  content: string,
  availableServers: MCPServer[]
): {
  primaryServer: MCPServer | null
  orchestrationNeeded: boolean
  toolContext?: ReturnType<typeof getToolContext>
} {
  const intent = analyzeRoutingIntent(content)
  const primaryServer = findBestServerForIntent(intent, availableServers)

  return {
    primaryServer,
    orchestrationNeeded: intent.requiresOrchestration || false,
    toolContext: primaryServer ? getToolContext(primaryServer.serverId) : undefined,
  }
}

/**
 * Get tool context information for a server
 */
export function getServerToolContext(server: MCPServer) {
  return getToolContext(server.serverId) || getToolContext(server.name)
}

