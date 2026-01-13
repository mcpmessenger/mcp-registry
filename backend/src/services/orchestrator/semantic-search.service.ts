/**
 * Semantic Search Engine
 * 
 * Pillar 1: Manages vector representations for 'zero-shot' tool discovery.
 * Uses embeddings to find tools semantically similar to user queries.
 */

import type { MCPServer } from '../../types/mcp'
import { registryService } from '../registry.service'

export interface ToolEmbedding {
  id: string
  serverId: string
  toolId: string
  toolName: string
  description: string
  embedding: number[] // Vector embedding
  keywords: string[]
  capabilities: string[]
  usageCount: number
  successRate: number
  createdAt: Date
  updatedAt: Date
}

export interface SemanticMatch {
  tool: ToolEmbedding
  confidence: number
  matchType: 'semantic' | 'keyword' | 'hybrid'
  reasoning: string
  similarityScore: number
  keywordScore: number
  usageScore: number
}

/**
 * Generate embeddings using OpenAI API or fallback to keyword-based
 */
class EmbeddingService {
  private apiKey?: string
  private useLocalFallback: boolean = true

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY
    if (!this.apiKey) {
      console.log('[EmbeddingService] No OpenAI API key found, using keyword-based fallback')
      this.useLocalFallback = true
    }
  }

  /**
   * Generate embedding for text
   * Uses OpenAI if available, otherwise falls back to keyword extraction
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (this.apiKey && !this.useLocalFallback) {
      try {
        return await this.generateOpenAIEmbedding(text)
      } catch (error) {
        console.warn('[EmbeddingService] OpenAI embedding failed, using fallback:', error)
        this.useLocalFallback = true
      }
    }
    
    // Fallback: return keyword-based "embedding" (normalized keyword vector)
    return this.generateKeywordEmbedding(text)
  }

  /**
   * Generate embedding using OpenAI API
   */
  private async generateOpenAIEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI embedding failed: ${response.statusText}`)
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> }
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error('Invalid embedding response format')
    }
    return data.data[0].embedding
  }

  /**
   * Generate keyword-based "embedding" (fallback)
   * Creates a normalized vector from keywords
   */
  private generateKeywordEmbedding(text: string): number[] {
    const keywords = this.extractKeywords(text)
    // Create a simple hash-based vector (not a real embedding, but works for similarity)
    const vector = new Array(384).fill(0)
    keywords.forEach((keyword, i) => {
      const hash = this.simpleHash(keyword)
      vector[hash % 384] += 1
    })
    
    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
    return magnitude > 0 ? vector.map(v => v / magnitude) : vector
  }

  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
    
    const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'use', 'her', 'she', 'many', 'some', 'time', 'very', 'what', 'when', 'where', 'which', 'will', 'with', 'have', 'this', 'that', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time'])
    
    return [...new Set(words.filter(w => !stopWords.has(w)))]
  }

  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  /**
   * Generate embedding for a tool
   */
  async generateToolEmbedding(tool: { name: string; description?: string }, server: MCPServer): Promise<ToolEmbedding> {
    const text = `${tool.name} ${tool.description || ''} ${server.name} ${server.description || ''}`
    const embedding = await this.generateEmbedding(text)
    const keywords = this.extractKeywords(text)
    
    return {
      id: `${server.serverId}::${tool.name}`,
      serverId: server.serverId,
      toolId: tool.name,
      toolName: tool.name,
      description: tool.description || '',
      embedding,
      keywords,
      capabilities: server.capabilities || [],
      usageCount: 0,
      successRate: 0.0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }
}

/**
 * Semantic Search Service
 * 
 * Performs vector similarity search and hybrid ranking
 */
export class SemanticSearchService {
  private embeddingService: EmbeddingService
  private toolEmbeddings: Map<string, ToolEmbedding> = new Map()
  private initialized: boolean = false

  constructor() {
    this.embeddingService = new EmbeddingService()
  }

  /**
   * Initialize by loading all tools and generating embeddings
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    console.log('[SemanticSearch] Initializing...')
    const servers = await registryService.getServers()
    
    for (const server of servers) {
      if (!server.tools || server.tools.length === 0) continue
      
      for (const tool of server.tools) {
        const embedding = await this.embeddingService.generateToolEmbedding(tool, server)
        this.toolEmbeddings.set(embedding.id, embedding)
      }
    }

    this.initialized = true
    console.log(`[SemanticSearch] Initialized with ${this.toolEmbeddings.size} tool embeddings`)
  }

  /**
   * Search for tools matching a query
   */
  async search(
    query: string,
    options: { limit?: number; minConfidence?: number } = {}
  ): Promise<SemanticMatch[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    const limit = options.limit || 10
    const minConfidence = options.minConfidence || 0.7

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query)
    const queryKeywords = this.embeddingService['extractKeywords'](query)

    // Calculate similarity for all tools
    const matches: SemanticMatch[] = []

    for (const tool of this.toolEmbeddings.values()) {
      // Vector similarity (cosine similarity)
      const similarity = this.cosineSimilarity(queryEmbedding, tool.embedding)
      
      // Keyword similarity
      const keywordScore = this.keywordSimilarity(queryKeywords, tool.keywords)
      
      // Usage score (normalized)
      const usageScore = Math.min(tool.usageCount / 100, 1) * 0.1
      
      // Hybrid confidence: semantic 70%, keyword 20%, usage 10%
      const confidence = (similarity * 0.7) + (keywordScore * 0.2) + usageScore

      if (confidence >= minConfidence) {
        matches.push({
          tool,
          confidence,
          matchType: similarity > 0.5 && keywordScore > 0.3 ? 'hybrid' : similarity > 0.5 ? 'semantic' : 'keyword',
          reasoning: `Similarity: ${(similarity * 100).toFixed(1)}%, Keywords: ${(keywordScore * 100).toFixed(1)}%`,
          similarityScore: similarity,
          keywordScore,
          usageScore,
        })
      }
    }

    // Sort by confidence and return top-k
    return matches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit)
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    return denominator > 0 ? dotProduct / denominator : 0
  }

  /**
   * Calculate keyword similarity (Jaccard)
   */
  private keywordSimilarity(queryKeywords: string[], toolKeywords: string[]): number {
    if (toolKeywords.length === 0) return 0
    
    const querySet = new Set(queryKeywords)
    const toolSet = new Set(toolKeywords)
    
    let matches = 0
    for (const keyword of querySet) {
      if (toolSet.has(keyword)) {
        matches++
      }
    }
    
    const union = new Set([...querySet, ...toolSet]).size
    return union > 0 ? matches / union : 0
  }

  /**
   * Update tool usage statistics
   */
  async recordUsage(serverId: string, toolId: string, success: boolean): Promise<void> {
    const id = `${serverId}::${toolId}`
    const tool = this.toolEmbeddings.get(id)
    
    if (tool) {
      tool.usageCount++
      if (success) {
        tool.successRate = (tool.successRate * (tool.usageCount - 1) + 1) / tool.usageCount
      } else {
        tool.successRate = (tool.successRate * (tool.usageCount - 1)) / tool.usageCount
      }
      tool.updatedAt = new Date()
    }
  }

  /**
   * Refresh embeddings (call when tools change)
   */
  async refresh(): Promise<void> {
    this.initialized = false
    this.toolEmbeddings.clear()
    await this.initialize()
  }
}

// Singleton instance
let semanticSearchInstance: SemanticSearchService | null = null

export function getSemanticSearchService(): SemanticSearchService {
  if (!semanticSearchInstance) {
    semanticSearchInstance = new SemanticSearchService()
  }
  return semanticSearchInstance
}
