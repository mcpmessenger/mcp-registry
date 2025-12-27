/**
 * MCP Matcher
 * 
 * Fast-path tool matching using keyword/regex and semantic search.
 * Emits TOOL_READY signals when high-confidence matches are found.
 */

import { createKafkaProducer, createKafkaConsumer } from './kafka'
import type { UserRequestEvent, ToolSignalEvent } from './events'
import { env } from '../../config/env'
import { registryService } from '../registry.service'
import { processMCPTools, findBestToolMatch, type ToolEmbedding } from './embeddings'

const CONFIDENCE_THRESHOLD = 0.7

/**
 * Keyword patterns for high-signal queries
 */
const KEYWORD_PATTERNS: Array<{ pattern: RegExp; toolId: string; serverId: string; confidence: number }> = [
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
  const producer = await createKafkaProducer()
  const consumer = await createKafkaConsumer('mcp-matcher')
  
  // Load and process all MCP servers for semantic search
  console.log('[MCP Matcher] Loading MCP servers from registry...')
  const servers = await registryService.getServers()
  console.log(`[MCP Matcher] Found ${servers.length} servers`)
  
  // Process tools and generate embeddings
  console.log('[MCP Matcher] Processing tools for semantic search...')
  const toolEmbeddings = await processMCPTools(servers)
  console.log(`[MCP Matcher] Processed ${toolEmbeddings.length} tools with embeddings/keywords`)
  
  await consumer.connect()
  await consumer.subscribe({ topic: env.kafka.topics.userRequests, fromBeginning: false })
  
  console.log('[MCP Matcher] Started, listening for user requests...')
  
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
          // Fallback to semantic search
          console.log(`[MCP Matcher] Trying semantic search...`)
          const semanticMatch = await findBestToolMatch(normalizedQuery, toolEmbeddings)
          
          if (semanticMatch && semanticMatch.confidence >= CONFIDENCE_THRESHOLD) {
            match = {
              toolId: semanticMatch.tool.toolId,
              serverId: semanticMatch.tool.serverId,
              confidence: semanticMatch.confidence,
              params: extractSearchParams(normalizedQuery),
            }
            console.log(`[MCP Matcher] Semantic match found: ${match.serverId}::${match.toolId} (confidence: ${match.confidence})`)
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
            topic: env.kafka.topics.toolSignals,
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

