/**
 * Tool Router
 * 
 * Routes user requests to appropriate MCP tools based on
 * core responsibilities and output contexts
 */

import type { MCPServer } from './api'
import { getToolContext, findToolsByOutputContext, findToolsByResponsibility } from '@/types/tool-context'

const HIGH_SIGNAL_SEARCH_KEYWORDS = [
  'when',
  'where',
  'date',
  'time',
  'show',
  'ticket',
  'tickets',
  'concert',
  'event',
  'tour',
  'gig',
  'playing',
  'performing',
  'venue',
  'schedule',
  'price',
  'cost',
  'availability',
  'on sale',
  'booking',
  'lineup',
  'how to get',
  'closest',
  'find'
]

const DESIGN_SIGNAL_KEYWORDS = [
  'design',
  'layout',
  'present',
  'showcase',
  'display',
  'story',
  'narrative',
  'plan',
  'strategy',
  'concept',
  'proposal',
  'mockup',
  'visual',
  'creative',
  'aesthetic',
  'illustrate',
  'diagram',
  'prototype'
]

const KEYWORD_SCORE_NORMALIZER = 4
const MIN_HIGH_SIGNAL_SEARCH_CONFIDENCE = 0.6

function calculateKeywordConfidence(content: string, keywords: string[]): number {
  if (!content) return 0
  const matches = new Set(
    keywords.filter(keyword => content.includes(keyword))
  )
  if (matches.size === 0) return 0
  return Math.min(matches.size / KEYWORD_SCORE_NORMALIZER, 1)
}

function isHighSignalSearchIntent(
  lowerContent: string,
  searchConfidence: number,
  designConfidence: number,
  hasMultiStep: boolean
): boolean {
  if (hasMultiStep) return false
  if (designConfidence >= 0.5) return false
  if (searchConfidence < MIN_HIGH_SIGNAL_SEARCH_CONFIDENCE) return false

  // Require at least one hard-signal keyword to avoid false positives
  const hardSignalRegex = /\b(when|where|date|ticket|tickets|show|concert|event|tour|gig|venue|playing)\b/
  return hardSignalRegex.test(lowerContent)
}

export function normalizeSearchText(text: string): string {
  if (!text) return ''
  return text
    .replace(/\bwhen'?s\b/gi, 'when is')
    .replace(/\bwhere'?s\b/gi, 'where is')
    .replace(/\bwhat'?s\b/gi, 'what is')
    .replace(/\bwho'?s\b/gi, 'who is')
    .replace(/\bhow'?s\b/gi, 'how is')
}

export function extractFollowUpQuery(content: string): string {
  if (!content) return ''
  const marker = 'Follow-up question:'
  const markerIndex = content.indexOf(marker)
  if (markerIndex === -1) {
    return content
  }

  const start = markerIndex + marker.length
  const endMarker = '\n\nPrevious context:'
  const endIndex = content.indexOf(endMarker, start)
  if (endIndex === -1) {
    return content.slice(start).trim()
  }

  return content.slice(start, endIndex).trim()
}

export interface RoutingIntent {
  needs: string[]
  preferredTool?: string
  requiresOrchestration?: boolean
  searchConfidence?: number
  designConfidence?: number
  forceSearch?: boolean
}

/**
 * Analyze user request to determine routing intent
 */
export function analyzeRoutingIntent(content: string): RoutingIntent {
  const normalizedContent = normalizeSearchText(content)
  const lowerContent = normalizedContent.toLowerCase()
  const needs: string[] = []
  let preferredTool: string | undefined
  let requiresOrchestration = false

  const searchConfidence = calculateKeywordConfidence(lowerContent, HIGH_SIGNAL_SEARCH_KEYWORDS)
  const designConfidence = calculateKeywordConfidence(lowerContent, DESIGN_SIGNAL_KEYWORDS)


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
                         lowerContent.includes('show') ||
                         lowerContent.includes('gig') ||
                         lowerContent.includes('tour') ||
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
    lowerContent.includes('show') ||
    lowerContent.includes('gig') ||
    lowerContent.includes('tour') ||
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
  
  const forceSearch = isHighSignalSearchIntent(lowerContent, searchConfidence, designConfidence, hasMultiStep)
  if (forceSearch) {
    preferredTool = 'search'
  }

  if (
    !forceSearch &&
    (
      (needs.length > 1 || hasMultiStep) && !isSimpleWebsiteCheck ||
      lowerContent.includes('synthesize') ||
      lowerContent.includes('combine') ||
      lowerContent.includes('report') ||
      lowerContent.includes('calculate') ||
      lowerContent.includes('analyze') ||
      lowerContent.includes('compare')
    )
  ) {
    requiresOrchestration = true
    // Only prefer LangChain if it's truly a multi-step query, not a simple website check
    if (!isSimpleWebsiteCheck) {
      preferredTool = 'langchain'
    }
  }

  return {
    needs,
    preferredTool,
    requiresOrchestration,
    searchConfidence,
    designConfidence,
    forceSearch,
  }
}

/**
 * Find the best matching server for a routing intent
 */
export function findBestServerForIntent(
  intent: RoutingIntent,
  availableServers: MCPServer[]
): MCPServer | null {
  // If an administrator set a default search server via env var, prefer it first
  const defaultSearchServerId = process.env.DEFAULT_SEARCH_SERVER_ID
  if (defaultSearchServerId) {
    const defaultServer = availableServers.find(s =>
      s.serverId === defaultSearchServerId ||
      s.serverId.includes(defaultSearchServerId) ||
      s.name.toLowerCase().includes(defaultSearchServerId.toLowerCase())
    )
    if (defaultServer) return defaultServer
  }

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

  // Special case: prefer Exa MCP when the preferred tool is 'search'
  if (intent.preferredTool === 'search') {
    const exaServer = availableServers.find(s =>
      s.serverId.toLowerCase().includes('exa') ||
      s.name.toLowerCase().includes('exa') ||
      (s.metadata && typeof s.metadata === 'object' && ((s.metadata as any).npmPackage === 'exa-mcp-server' || JSON.stringify(s.metadata).toLowerCase().includes('exa-mcp-server')))
    )
    if (exaServer) return exaServer
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
  const cleanedContent = extractFollowUpQuery(content)
  const intent = analyzeRoutingIntent(cleanedContent)
  const normalizedContent = normalizeSearchText(cleanedContent)

  if (intent.forceSearch) {
    intent.requiresOrchestration = false
    intent.preferredTool = 'search'
  }

  let primaryServer = findBestServerForIntent(intent, availableServers)

  // If this is a concert/ticket search (e.g., "when is X playing in Y" or "find X concerts"),
  // prefer Exa (search provider) when available unless the user explicitly requested a specific site.
  const isConcertQuery = /\b(concert|concerts|playing|when\s+is|tickets?)\b/i.test(normalizedContent)
  const explicitSite = /\busing\s+\w+\.com|ticketmaster|stubhub|see tickets|get tickets|on\s+\w+\.com\b/i.test(content)
  if (isConcertQuery && !explicitSite) {
    const exaServer = availableServers.find(s =>
      s.serverId.toLowerCase().includes('exa') ||
      s.name.toLowerCase().includes('exa') ||
      (s.metadata && typeof s.metadata === 'object' && ((s.metadata as any).npmPackage === 'exa-mcp-server' || JSON.stringify(s.metadata).toLowerCase().includes('exa-mcp-server')))
    )
    if (exaServer) {
      primaryServer = exaServer
    }
  }

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

