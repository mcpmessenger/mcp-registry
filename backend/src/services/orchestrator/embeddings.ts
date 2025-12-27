/**
 * Embedding Service
 * 
 * Performs semantic search using keyword-based similarity.
 * Can be extended with vector embeddings in the future.
 */

import type { MCPServer } from '../../types/mcp'

export interface ToolEmbedding {
  serverId: string
  toolId: string
  description: string
  keywords: string[]
  searchText: string // Combined text for matching
}

const SIMILARITY_THRESHOLD = 0.7

/**
 * Extract keywords from text for fallback matching
 */
function extractKeywords(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
  
  // Remove common stop words
  const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'use', 'her', 'she', 'many', 'some', 'time', 'very', 'what', 'when', 'where', 'which', 'will', 'with', 'have', 'this', 'that', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time'])
  
  return [...new Set(words.filter(w => !stopWords.has(w)))]
}

/**
 * Calculate keyword overlap similarity using Jaccard similarity
 */
function keywordSimilarity(queryKeywords: string[], toolKeywords: string[]): number {
  if (toolKeywords.length === 0) return 0
  
  const querySet = new Set(queryKeywords)
  const toolSet = new Set(toolKeywords)
  
  let matches = 0
  for (const keyword of querySet) {
    if (toolSet.has(keyword)) {
      matches++
    }
  }
  
  // Jaccard similarity
  const union = new Set([...querySet, ...toolSet]).size
  return union > 0 ? matches / union : 0
}

/**
 * Calculate text similarity using substring matching and keyword overlap
 */
function textSimilarity(query: string, toolText: string): number {
  const lowerQuery = query.toLowerCase()
  const lowerTool = toolText.toLowerCase()
  
  // Exact substring match gets high score
  if (lowerTool.includes(lowerQuery) || lowerQuery.includes(lowerTool)) {
    return 0.9
  }
  
  // Word-level matching
  const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 2)
  const toolWords = lowerTool.split(/\s+/).filter(w => w.length > 2)
  
  let matches = 0
  for (const word of queryWords) {
    if (toolWords.some(tw => tw.includes(word) || word.includes(tw))) {
      matches++
    }
  }
  
  return queryWords.length > 0 ? matches / queryWords.length : 0
}

/**
 * Process MCP servers and extract keywords for all tools
 */
export async function processMCPTools(servers: MCPServer[]): Promise<ToolEmbedding[]> {
  const toolEmbeddings: ToolEmbedding[] = []
  
  for (const server of servers) {
    if (!server.tools || server.tools.length === 0) continue
    
    for (const tool of server.tools) {
      const description = tool.description || tool.name || ''
      const searchText = `${tool.name} ${description} ${server.name} ${server.description || ''}`.toLowerCase()
      const keywords = extractKeywords(searchText)
      
      toolEmbeddings.push({
        serverId: server.serverId,
        toolId: tool.name,
        description,
        keywords,
        searchText,
      })
    }
  }
  
  console.log(`[Embeddings] Processed ${toolEmbeddings.length} tools from ${servers.length} servers`)
  return toolEmbeddings
}

/**
 * Find best matching tool using semantic/keyword search
 */
export async function findBestToolMatch(
  query: string,
  toolEmbeddings: ToolEmbedding[]
): Promise<{ tool: ToolEmbedding; confidence: number } | null> {
  if (toolEmbeddings.length === 0) return null
  
  const queryKeywords = extractKeywords(query)
  const lowerQuery = query.toLowerCase()
  
  let bestMatch: { tool: ToolEmbedding; confidence: number } | null = null
  
  for (const tool of toolEmbeddings) {
    // Combine text similarity and keyword similarity
    const textSim = textSimilarity(lowerQuery, tool.searchText)
    const keywordSim = keywordSimilarity(queryKeywords, tool.keywords)
    
    // Weighted combination (text similarity is more important)
    const confidence = (textSim * 0.6) + (keywordSim * 0.4)
    
    if (confidence > (bestMatch?.confidence || 0) && confidence >= SIMILARITY_THRESHOLD) {
      bestMatch = { tool, confidence }
    }
  }
  
  return bestMatch
}

