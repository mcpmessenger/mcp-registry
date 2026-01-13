/**
 * Documentation Search (RAG)
 * 
 * Pillar 6: Uses RAG to help the orchestrator understand how to use complex tools.
 * Provides context-aware documentation retrieval for tool usage.
 */

import type { MCPServer } from '../../types/mcp'
import { registryService } from '../registry.service'
import { getSemanticSearchService } from './semantic-search.service'

export interface ToolDocumentation {
  serverId: string
  toolId: string
  toolName: string
  description: string
  examples: string[]
  parameters: Array<{
    name: string
    type: string
    description: string
    required: boolean
  }>
  usagePatterns: string[]
  commonErrors: string[]
  bestPractices: string[]
}

export interface DocumentationMatch {
  documentation: ToolDocumentation
  relevance: number
  matchedSections: string[]
}

/**
 * Documentation Search Service
 * 
 * Retrieves and ranks tool documentation based on query context
 */
export class DocumentationSearchService {
  private documentationCache: Map<string, ToolDocumentation> = new Map()
  private semanticSearch = getSemanticSearchService()

  /**
   * Initialize documentation from MCP servers
   */
  async initialize(): Promise<void> {
    console.log('[DocumentationSearch] Initializing...')
    const servers = await registryService.getServers()
    
    for (const server of servers) {
      if (!server.tools || server.tools.length === 0) continue
      
      for (const tool of server.tools) {
        const doc = this.extractDocumentation(tool, server)
        this.documentationCache.set(`${server.serverId}::${tool.name}`, doc)
      }
    }

    console.log(`[DocumentationSearch] Initialized with ${this.documentationCache.size} tool documentations`)
  }

  /**
   * Extract documentation from tool schema and metadata
   */
  private extractDocumentation(tool: { name: string; description?: string; inputSchema?: any }, server: MCPServer): ToolDocumentation {
    const schema = tool.inputSchema || {}
    const properties = schema.properties || {}
    const required = schema.required || []

    // Extract parameters
    const parameters = Object.entries(properties).map(([name, prop]: [string, any]) => ({
      name,
      type: prop.type || 'string',
      description: prop.description || '',
      required: required.includes(name),
    }))

    // Extract examples from description or metadata
    const examples = this.extractExamples(tool.description || '', server.metadata)

    // Generate usage patterns from tool description
    const usagePatterns = this.generateUsagePatterns(tool.description || '', tool.name)

    return {
      serverId: server.serverId,
      toolId: tool.name,
      toolName: tool.name,
      description: tool.description || '',
      examples,
      parameters,
      usagePatterns,
      commonErrors: this.getCommonErrors(tool.name, server.serverId),
      bestPractices: this.getBestPractices(tool.name, server.serverId),
    }
  }

  /**
   * Extract examples from text
   */
  private extractExamples(description: string, metadata?: any): string[] {
    const examples: string[] = []
    
    // Look for example patterns in description
    const examplePatterns = [
      /example[:\s]+(.+?)(?:\n|$)/gi,
      /e\.g\.\s*(.+?)(?:\n|$)/gi,
      /for example[:\s]+(.+?)(?:\n|$)/gi,
    ]
    
    for (const pattern of examplePatterns) {
      const matches = description.matchAll(pattern)
      for (const match of matches) {
        if (match[1]) {
          examples.push(match[1].trim())
        }
      }
    }

    // Check metadata for examples
    if (metadata && typeof metadata === 'object') {
      if (metadata.examples && Array.isArray(metadata.examples)) {
        examples.push(...metadata.examples)
      }
    }

    return examples.slice(0, 5) // Limit to 5 examples
  }

  /**
   * Generate usage patterns from description
   */
  private generateUsagePatterns(description: string, toolName: string): string[] {
    const patterns: string[] = []
    const lowerDesc = description.toLowerCase()
    
    // Common patterns
    if (lowerDesc.includes('search') || lowerDesc.includes('find')) {
      patterns.push(`Use ${toolName} to search for information`)
    }
    if (lowerDesc.includes('navigate') || lowerDesc.includes('visit')) {
      patterns.push(`Use ${toolName} to navigate to websites`)
    }
    if (lowerDesc.includes('analyze') || lowerDesc.includes('process')) {
      patterns.push(`Use ${toolName} to analyze data or content`)
    }
    if (lowerDesc.includes('generate') || lowerDesc.includes('create')) {
      patterns.push(`Use ${toolName} to generate or create content`)
    }

    return patterns
  }

  /**
   * Get common errors for a tool (from knowledge base)
   */
  private getCommonErrors(toolName: string, serverId: string): string[] {
    const errorMap: Record<string, string[]> = {
      'browser_navigate': [
        'URL must be a valid HTTP/HTTPS URL',
        'Timeout may occur if page takes too long to load',
        'Some websites may block automated browsers',
      ],
      'web_search_exa': [
        'Query must be at least 3 characters',
        'API rate limits may apply',
        'Some results may require authentication',
      ],
      'agent_executor': [
        'Query must be clear and specific',
        'May hit iteration limits for complex queries',
        'Requires valid API keys for tool execution',
      ],
    }

    return errorMap[toolName] || []
  }

  /**
   * Get best practices for a tool
   */
  private getBestPractices(toolName: string, serverId: string): string[] {
    const practicesMap: Record<string, string[]> = {
      'browser_navigate': [
        'Always provide a valid URL',
        'Use search_query parameter for auto-search',
        'Set appropriate wait_timeout for slow pages',
      ],
      'web_search_exa': [
        'Be specific in search queries',
        'Include location if searching for places',
        'Use quotes for exact phrase matches',
      ],
      'agent_executor': [
        'Break complex queries into steps',
        'Provide context from previous messages',
        'Specify which tools to use when possible',
      ],
    }

    return practicesMap[toolName] || []
  }

  /**
   * Search documentation for a query
   */
  async search(
    query: string,
    toolId?: string,
    serverId?: string
  ): Promise<DocumentationMatch[]> {
    const matches: DocumentationMatch[] = []

    // If specific tool requested, return its documentation
    if (toolId && serverId) {
      const key = `${serverId}::${toolId}`
      const doc = this.documentationCache.get(key)
      if (doc) {
        const relevance = this.calculateRelevance(query, doc)
        matches.push({
          documentation: doc,
          relevance,
          matchedSections: this.findMatchedSections(query, doc),
        })
      }
      return matches
    }

    // Search all documentation
    for (const doc of this.documentationCache.values()) {
      const relevance = this.calculateRelevance(query, doc)
      if (relevance > 0.3) {
        matches.push({
          documentation: doc,
          relevance,
          matchedSections: this.findMatchedSections(query, doc),
        })
      }
    }

    // Sort by relevance
    return matches.sort((a, b) => b.relevance - a.relevance).slice(0, 10)
  }

  /**
   * Calculate relevance score for documentation
   */
  private calculateRelevance(query: string, doc: ToolDocumentation): number {
    const lowerQuery = query.toLowerCase()
    let score = 0

    // Check description
    if (doc.description.toLowerCase().includes(lowerQuery)) {
      score += 0.4
    }

    // Check tool name
    if (doc.toolName.toLowerCase().includes(lowerQuery)) {
      score += 0.3
    }

    // Check examples
    const matchingExamples = doc.examples.filter(ex => 
      ex.toLowerCase().includes(lowerQuery)
    )
    score += matchingExamples.length * 0.1

    // Check usage patterns
    const matchingPatterns = doc.usagePatterns.filter(pattern =>
      pattern.toLowerCase().includes(lowerQuery)
    )
    score += matchingPatterns.length * 0.1

    // Check parameters
    const matchingParams = doc.parameters.filter(param =>
      param.name.toLowerCase().includes(lowerQuery) ||
      param.description.toLowerCase().includes(lowerQuery)
    )
    score += matchingParams.length * 0.05

    return Math.min(score, 1.0)
  }

  /**
   * Find which sections matched the query
   */
  private findMatchedSections(query: string, doc: ToolDocumentation): string[] {
    const lowerQuery = query.toLowerCase()
    const sections: string[] = []

    if (doc.description.toLowerCase().includes(lowerQuery)) {
      sections.push('description')
    }
    if (doc.examples.some(ex => ex.toLowerCase().includes(lowerQuery))) {
      sections.push('examples')
    }
    if (doc.usagePatterns.some(p => p.toLowerCase().includes(lowerQuery))) {
      sections.push('usage patterns')
    }
    if (doc.parameters.some(p => p.name.toLowerCase().includes(lowerQuery) || p.description.toLowerCase().includes(lowerQuery))) {
      sections.push('parameters')
    }

    return sections
  }

  /**
   * Get documentation for a specific tool
   */
  async getToolDocumentation(serverId: string, toolId: string): Promise<ToolDocumentation | null> {
    const key = `${serverId}::${toolId}`
    return this.documentationCache.get(key) || null
  }

  /**
   * Refresh documentation (call when tools change)
   */
  async refresh(): Promise<void> {
    this.documentationCache.clear()
    await this.initialize()
  }
}

// Singleton instance
let documentationSearchInstance: DocumentationSearchService | null = null

export function getDocumentationSearchService(): DocumentationSearchService {
  if (!documentationSearchInstance) {
    documentationSearchInstance = new DocumentationSearchService()
  }
  return documentationSearchInstance
}
