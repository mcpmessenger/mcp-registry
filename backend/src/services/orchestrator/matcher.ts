/**
 * MCP Matcher
 * 
 * Fast-path tool matching using keyword/regex and semantic search.
 * Emits TOOL_READY signals when high-confidence matches are found.
 */

import { createPulsarProducer, createPulsarConsumer, sendPulsarMessage, receivePulsarMessage, type PulsarProducer, type PulsarConsumer } from './pulsar'
import { createProducer, createConsumer, sendMessage, isPulsarEnabled } from './messaging'
import type { UserRequestEvent, ToolSignalEvent } from './events'
import { env } from '../../config/env'
import { registryService } from '../registry.service'
import { processMCPTools, findBestToolMatch, type ToolEmbedding } from './embeddings'
import { getSemanticSearchService } from './semantic-search.service'

// Helper to get topic name (works for both Kafka and Pulsar)
function getTopic(topicKey: keyof typeof env.pulsar.topics): string {
  return isPulsarEnabled() ? env.pulsar.topics[topicKey] : env.kafka.topics[topicKey]
}

const CONFIDENCE_THRESHOLD = 0.7

/**
 * Keyword patterns for high-signal queries
 */
const KEYWORD_PATTERNS: Array<{ pattern: RegExp; toolId: string; serverId: string; confidence: number }> = [
  // Weather/temperature queries - route to Google Maps lookup_weather (HIGHEST PRIORITY)
  {
    pattern: /\b(what.*?temp|what.*?weather|whats.*?temp|whats.*?weather|temperature|temp|weather|forecast|climate).*?(in|at|for|of)\b/i,
    toolId: 'lookup_weather',
    serverId: 'modelcontextprotocol/google-maps',
    confidence: 0.98,
  },
  {
    pattern: /\b(how.*?hot|cold|warm|weather.*?in|temp.*?in)\b/i,
    toolId: 'lookup_weather',
    serverId: 'modelcontextprotocol/google-maps',
    confidence: 0.95,
  },
  // Directions / routes
  {
    pattern: /\b(directions|route|routes|navigate|navigation|how do i get|how to get|get from|drive from|walk from|bike from|transit from)\b.*\bfrom\b.*\bto\b/i,
    toolId: 'compute_routes',
    serverId: 'modelcontextprotocol/google-maps',
    confidence: 0.92,
  },
  // Concert/event searches
  {
    pattern: /\b(when|where|find|search|look for).*?(concert|playing|show|ticket|event|tour)\b/i,
    toolId: 'web_search_exa',
    serverId: 'io.github.exa-labs/exa-mcp-server',
    confidence: 0.9,
  },
  {
    pattern: /\b(concert|playing|show|ticket).*?(in|at|near|for)\b/i,
    toolId: 'web_search_exa',
    serverId: 'io.github.exa-labs/exa-mcp-server',
    confidence: 0.85,
  },
  // Places searches (coffee shops, restaurants, stores, etc.) - route to Google Maps
  // Exclude weather queries with negative lookahead
  {
    pattern: /\b(find|search|look for|where).*?(coffee|restaurant|cafe|shop|store|bar|pizza|food|record|book|clothing|grocery|gas|hotel|museum|park|theater).*?(in|at|near)\b/i,
    toolId: 'search_places',
    serverId: 'modelcontextprotocol/google-maps',
    confidence: 0.9,
  },
  {
    pattern: /\b(coffee|restaurant|cafe|shop|store|record|book|clothing|grocery|gas|hotel|museum|park|theater).*?(in|at|near)\b/i,
    toolId: 'search_places',
    serverId: 'modelcontextprotocol/google-maps',
    confidence: 0.85,
  },
  // Playwright for explicit website checks
  {
    pattern: /\b(check|visit|go to|navigate).*?\.(com|org|net|io)\b/i,
    toolId: 'browser_navigate',
    serverId: 'com.microsoft.playwright/mcp',
    confidence: 0.8,
  },
]

/**
 * Extract search parameters from query
 */
function extractSearchParams(query: string): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  
  // Extract directions/routes queries - format for Google Maps compute_routes
  // Example: "directions from Chicago to Milwaukee" or "route from A to B"
  const directionsMatch = query.match(/\bfrom\s+(.+?)\s+to\s+(.+?)(?:\s*$|\s+by\b|\s+via\b)/i)
  if (directionsMatch && /\b(directions|route|routes|navigate|navigation|get from|how do i get|how to get)\b/i.test(query)) {
    const origin = directionsMatch[1].trim()
    const destination = directionsMatch[2].trim()

    // Map travel mode keywords to API enum
    let travelMode: 'DRIVE' | 'WALK' | 'BICYCLE' | 'TRANSIT' = 'DRIVE'
    if (/\bwalk|walking\b/i.test(query)) travelMode = 'WALK'
    else if (/\bbike|bicycle|cycling\b/i.test(query)) travelMode = 'BICYCLE'
    else if (/\btransit|bus|train|subway\b/i.test(query)) travelMode = 'TRANSIT'

    params.origin = { address: origin }
    params.destination = { address: destination }
    params.travelMode = travelMode
    return params
  }

  // Extract weather/temperature queries - format for Google Maps lookup_weather
  // Handle both "what's the temp" and "WHATS THE TEMP" (all caps)
  const weatherMatch = query.match(/\b(what.*?temp|what.*?weather|whats.*?temp|whats.*?weather|temperature|temp|weather|forecast).*?(in|at|for|of)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)\b/i)
  if (weatherMatch) {
    // Google Maps lookup_weather expects location object with address
    const locationName = weatherMatch[3].trim()
    params.location = {
      address: locationName
    }
    return params
  }
  
  // Extract places queries (record store, coffee shop, etc.) - format for Google Maps textQuery (camelCase)
  const placesMatch = query.match(/\b(find|search|look for|where)\s+(.+?)\s+(in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/i)
  if (placesMatch) {
    // Google Maps expects textQuery (camelCase) as single string: "coffee shops in des moines"
    params.textQuery = `${placesMatch[2].trim()} in ${placesMatch[4].trim()}`
    return params
  }
  
  // Fallback: match "coffee shops in des moines" without "find/search"
  // BUT exclude weather queries
  if (!/\b(what.*?temp|what.*?weather|whats.*?temp|whats.*?weather|temperature|weather|forecast)\b/i.test(query)) {
    const simplePlacesMatch = query.match(/\b(.+?)\s+(in|at|near)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)\b/i)
    if (simplePlacesMatch && /\b(coffee|restaurant|cafe|shop|store|record|book|clothing|grocery|gas|hotel|museum|park|theater|bar|pizza|food)\b/i.test(simplePlacesMatch[1])) {
      params.textQuery = `${simplePlacesMatch[1].trim()} in ${simplePlacesMatch[3].trim()}`
      return params
    }
  }
  
  // Extract search query
  const searchMatch = query.match(/(?:when|where|find|search|look for)\s+(.+?)(?:\s+in|\s+at|$)/i)
  if (searchMatch) {
    params.query = searchMatch[1].trim()
  } else {
    // Use full query as search term
    params.query = query
  }
  
  // Extract location if present
  const locationMatch = query.match(/\b(in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/i)
  if (locationMatch) {
    params.location = locationMatch[2].trim()
  }
  
  return params
}

/**
 * Match query against keyword patterns
 */
function matchKeywordPattern(query: string): { toolId: string; serverId: string; confidence: number; params: Record<string, unknown> } | null {
  for (const { pattern, toolId, serverId, confidence } of KEYWORD_PATTERNS) {
    if (pattern.test(query)) {
      const params = extractSearchParams(query)
      return { toolId, serverId, confidence, params }
    }
  }
  return null
}

/**
 * Start MCP Matcher consumer
 */
export async function startMCPMatcher(): Promise<() => Promise<void>> {
  const userRequestsTopic = getTopic('userRequests')
  const toolSignalsTopic = getTopic('toolSignals')
  
  // Load and process all MCP servers for semantic search
  console.log('[MCP Matcher] Loading MCP servers from registry...')
  const servers = await registryService.getServers()
  console.log(`[MCP Matcher] Found ${servers.length} servers`)
  
  // Initialize Semantic Search Engine (Pillar 1)
  const semanticSearch = getSemanticSearchService()
  await semanticSearch.initialize()
  
  // Also keep legacy keyword-based embeddings for fallback
  console.log('[MCP Matcher] Processing tools for keyword fallback...')
  const toolEmbeddings = await processMCPTools(servers)
  console.log(`[MCP Matcher] Processed ${toolEmbeddings.length} tools with embeddings/keywords`)
  
  let isRunning = true
  
  if (isPulsarEnabled()) {
    // Pulsar implementation
    const producer = await createPulsarProducer(toolSignalsTopic)
    const consumer = await createPulsarConsumer(userRequestsTopic, 'mcp-matcher')
    
    console.log('[MCP Matcher] Started (Pulsar), listening for user requests...')
    
    // Start message processing loop
    const processLoop = async () => {
      while (isRunning) {
        try {
          const msg = await receivePulsarMessage(consumer, 1000) // 1s timeout
          if (!msg) continue
          
          try {
            const event: UserRequestEvent = JSON.parse(msg.getData().toString())
            const { requestId, normalizedQuery } = event
            
            console.log(`[MCP Matcher] Processing request ${requestId}: "${normalizedQuery.substring(0, 50)}..."`)
            
            let match: { toolId: string; serverId: string; confidence: number; params: Record<string, unknown> } | null = null
            
            // Try keyword pattern matching first (fastest)
            const keywordMatch = matchKeywordPattern(normalizedQuery)
            if (keywordMatch && keywordMatch.confidence >= CONFIDENCE_THRESHOLD) {
              match = keywordMatch
              console.log(`[MCP Matcher] Keyword match found: ${match.serverId}::${match.toolId} (confidence: ${match.confidence})`)
            } else {
              // Try enhanced semantic search (Pillar 1) first
              console.log(`[MCP Matcher] Trying enhanced semantic search...`)
              const semanticSearch = getSemanticSearchService()
              const semanticMatches = await semanticSearch.search(normalizedQuery, {
                limit: 1,
                minConfidence: CONFIDENCE_THRESHOLD,
              })
              
              if (semanticMatches.length > 0) {
                const semanticMatch = semanticMatches[0]
                match = {
                  toolId: semanticMatch.tool.toolId,
                  serverId: semanticMatch.tool.serverId,
                  confidence: semanticMatch.confidence,
                  params: extractSearchParams(normalizedQuery),
                }
                console.log(`[MCP Matcher] Enhanced semantic match found: ${match.serverId}::${match.toolId} (confidence: ${match.confidence}, type: ${semanticMatch.matchType})`)
              } else {
                // Fallback to legacy keyword-based search
                console.log(`[MCP Matcher] Trying legacy keyword search...`)
                const legacyMatch = await findBestToolMatch(normalizedQuery, toolEmbeddings)
                
                if (legacyMatch && legacyMatch.confidence >= CONFIDENCE_THRESHOLD) {
                  match = {
                    toolId: legacyMatch.tool.toolId,
                    serverId: legacyMatch.tool.serverId,
                    confidence: legacyMatch.confidence,
                    params: extractSearchParams(normalizedQuery),
                  }
                  console.log(`[MCP Matcher] Legacy keyword match found: ${match.serverId}::${match.toolId} (confidence: ${match.confidence})`)
                }
              }
            }
            
            if (match && match.confidence >= CONFIDENCE_THRESHOLD) {
              // Verify server exists in registry
              const server = await registryService.getServerById(match.serverId)
              if (!server) {
                console.warn(`[MCP Matcher] Server ${match.serverId} not found in registry, skipping match`)
                consumer.acknowledge(msg)
                continue
              }
              
              // Verify tool exists
              const tool = server.tools?.find(t => t.name === match.toolId)
              if (!tool) {
                console.warn(`[MCP Matcher] Tool ${match.toolId} not found on server ${match.serverId}, skipping match`)
                consumer.acknowledge(msg)
                continue
              }
              
              // Emit TOOL_READY signal
              const toolSignal: ToolSignalEvent = {
                requestId,
                toolId: match.toolId,
                serverId: match.serverId,
                params: match.params,
                confidence: match.confidence,
                status: 'TOOL_READY',
                timestamp: new Date().toISOString(),
              }
              
              await sendPulsarMessage(producer, toolSignal, {
                requestId,
                status: 'TOOL_READY',
              })
              
              console.log(`[MCP Matcher] Emitted TOOL_READY for ${requestId}: ${match.serverId}::${match.toolId} (confidence: ${match.confidence})`)
            } else {
              console.log(`[MCP Matcher] No high-confidence match for ${requestId} (keyword: ${keywordMatch?.confidence || 0}, semantic: N/A)`)
            }
            
            consumer.acknowledge(msg)
          } catch (error) {
            console.error('[MCP Matcher] Error processing message:', error)
            consumer.negativeAcknowledge(msg)
          }
        } catch (error) {
          // Timeout or other error, continue loop
          if (error instanceof Error && !error.message.includes('timeout')) {
            console.error('[MCP Matcher] Error in processing loop:', error)
          }
        }
      }
    }
    
    processLoop().catch(error => {
      console.error('[MCP Matcher] Processing loop crashed', error)
    })
    
    return async () => {
      isRunning = false
      await consumer.close()
      await producer.close()
      console.log('[MCP Matcher] Stopped')
    }
  } else {
    // Kafka implementation (legacy)
    const { createKafkaProducer, createKafkaConsumer } = await import('./kafka')
    const producer = await createKafkaProducer()
    const consumer = createKafkaConsumer('mcp-matcher')
    
    await consumer.connect()
    await consumer.subscribe({ topic: userRequestsTopic, fromBeginning: false })
    
    console.log('[MCP Matcher] Started (Kafka), listening for user requests...')
    
    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          if (!message.value) return
          
          const event: UserRequestEvent = JSON.parse(message.value.toString())
          const { requestId, normalizedQuery } = event
          
          console.log(`[MCP Matcher] Processing request ${requestId}: "${normalizedQuery.substring(0, 50)}..."`)
          
          let match: { toolId: string; serverId: string; confidence: number; params: Record<string, unknown> } | null = null
          
          // Try keyword pattern matching first (fastest)
          const keywordMatch = matchKeywordPattern(normalizedQuery)
          if (keywordMatch && keywordMatch.confidence >= CONFIDENCE_THRESHOLD) {
            match = keywordMatch
            console.log(`[MCP Matcher] Keyword match found: ${match.serverId}::${match.toolId} (confidence: ${match.confidence})`)
          } else {
            // Try enhanced semantic search (Pillar 1) first
            console.log(`[MCP Matcher] Trying enhanced semantic search...`)
            const semanticSearch = getSemanticSearchService()
            const semanticMatches = await semanticSearch.search(normalizedQuery, {
              limit: 1,
              minConfidence: CONFIDENCE_THRESHOLD,
            })
            
            if (semanticMatches.length > 0) {
              const semanticMatch = semanticMatches[0]
              match = {
                toolId: semanticMatch.tool.toolId,
                serverId: semanticMatch.tool.serverId,
                confidence: semanticMatch.confidence,
                params: extractSearchParams(normalizedQuery),
              }
              console.log(`[MCP Matcher] Enhanced semantic match found: ${match.serverId}::${match.toolId} (confidence: ${match.confidence}, type: ${semanticMatch.matchType})`)
            } else {
              // Fallback to legacy keyword-based search
              console.log(`[MCP Matcher] Trying legacy keyword search...`)
              const legacyMatch = await findBestToolMatch(normalizedQuery, toolEmbeddings)
              
              if (legacyMatch && legacyMatch.confidence >= CONFIDENCE_THRESHOLD) {
                match = {
                  toolId: legacyMatch.tool.toolId,
                  serverId: legacyMatch.tool.serverId,
                  confidence: legacyMatch.confidence,
                  params: extractSearchParams(normalizedQuery),
                }
                console.log(`[MCP Matcher] Legacy keyword match found: ${match.serverId}::${match.toolId} (confidence: ${match.confidence})`)
              }
            }
          }
          
          if (match && match.confidence >= CONFIDENCE_THRESHOLD) {
            // Verify server exists in registry
            const server = await registryService.getServerById(match.serverId)
            if (!server) {
              console.warn(`[MCP Matcher] Server ${match.serverId} not found in registry, skipping match`)
              return
            }
            
            // Verify tool exists
            const tool = server.tools?.find(t => t.name === match.toolId)
            if (!tool) {
              console.warn(`[MCP Matcher] Tool ${match.toolId} not found on server ${match.serverId}, skipping match`)
              return
            }
            
            // Emit TOOL_READY signal
            const toolSignal: ToolSignalEvent = {
              requestId,
              toolId: match.toolId,
              serverId: match.serverId,
              params: match.params,
              confidence: match.confidence,
              status: 'TOOL_READY',
              timestamp: new Date().toISOString(),
            }
            
            await producer.send({
              topic: toolSignalsTopic,
              messages: [{
                key: requestId,
                value: JSON.stringify(toolSignal),
                headers: {
                  requestId,
                  status: 'TOOL_READY',
                },
              }],
            })
            
            console.log(`[MCP Matcher] Emitted TOOL_READY for ${requestId}: ${match.serverId}::${match.toolId} (confidence: ${match.confidence})`)
          } else {
            console.log(`[MCP Matcher] No high-confidence match for ${requestId} (keyword: ${keywordMatch?.confidence || 0}, semantic: N/A)`)
          }
        } catch (error) {
          console.error('[MCP Matcher] Error processing message:', error)
        }
      },
    })
    
    return async () => {
      await consumer.disconnect()
      await producer.disconnect()
      console.log('[MCP Matcher] Stopped')
    }
  }
}

