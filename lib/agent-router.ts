/**
 * Intelligent Agent Router
 * 
 * Analyzes user messages and selects the best agent based on:
 * - Message content and keywords
 * - Agent capabilities and tools
 * - Agent descriptions
 * - Previous routing history (for consistency)
 */

import type { MCPAgent } from '@/types/agent'

export interface RoutingDecision {
  agent: MCPAgent | null
  agentName: string
  confidence: number // 0-1, how confident we are in this routing
  reason: string // Why this agent was selected
}

/**
 * Agent capability patterns
 * Maps keywords to agent types and their tools
 */
const AGENT_PATTERNS: Record<string, {
  keywords: string[]
  toolPatterns: string[]
  agentNamePatterns: string[]
  priority: number // Higher = more specific match
}> = {
  playwright: {
    keywords: [
      'screenshot', 'capture', 'snapshot', 'browser', 'navigate', 'click', 'type', 'fill',
      'page structure', 'accessibility', 'dom', 'html', 'website', 'web page', 'url',
      'go to', 'visit', 'open', 'goto', 'navigate to', 'avigate to', 'take a picture',
      'show me the page', 'page content', 'element', 'button', 'link', 'form'
    ],
    toolPatterns: ['browser_', 'navigate', 'screenshot', 'snapshot', 'click', 'type'],
    agentNamePatterns: ['playwright', 'browser', 'web'],
    priority: 10,
  },
  vision: {
    keywords: [
      'image', 'photo', 'picture', 'visual', 'see', 'look', 'analyze image', 'what is in',
      'describe', 'identify', 'recognize', 'detect', 'vision', 'ocr', 'text in image'
    ],
    toolPatterns: ['vision', 'image', 'analyze', 'ocr', 'detect'],
    agentNamePatterns: ['vision', 'image', 'visual'],
    priority: 9,
  },
  document: {
    keywords: [
      'document', 'pdf', 'file', 'analyze document', 'extract', 'parse', 'read file',
      'text extraction', 'document analysis', 'summarize document'
    ],
    toolPatterns: ['document', 'analyze', 'extract', 'parse', 'pdf'],
    agentNamePatterns: ['document', 'file', 'pdf'],
    priority: 8,
  },
  langchain: {
    keywords: [
      'agent', 'orchestrate', 'chain', 'workflow', 'multi-step', 'complex', 'reasoning',
      'plan', 'execute', 'coordinate', 'orchestration'
    ],
    toolPatterns: ['agent_executor', 'chain', 'orchestrate', 'plan'],
    agentNamePatterns: ['langchain', 'agent', 'orchestrator'],
    priority: 7,
  },
  data: {
    keywords: [
      'data', 'analyze', 'analysis', 'insights', 'metrics', 'statistics', 'chart', 'graph',
      'visualize', 'process data', 'data processing', 'dataset'
    ],
    toolPatterns: ['analyze', 'process', 'data', 'insights'],
    agentNamePatterns: ['data', 'analysis', 'analytics'],
    priority: 6,
  },
}

/**
 * Score an agent based on how well it matches the user's intent
 */
function scoreAgent(
  agent: MCPAgent,
  message: string,
  attachment?: { type: string }
): { score: number; reasons: string[] } {
  const lowerMessage = message.toLowerCase()
  let score = 0
  const reasons: string[] = []

  // Parse agent manifest to get tools and description
  let agentTools: string[] = []
  let agentDescription = ''
  let agentName = agent.name.toLowerCase()

  try {
    const manifest = JSON.parse(agent.manifest)
    agentTools = manifest.tools?.map((t: any) => t.name?.toLowerCase() || '') || []
    agentDescription = (manifest.description || '').toLowerCase()
    agentName = (manifest.name || agent.name || '').toLowerCase()
  } catch {
    // If manifest parsing fails, use what we have
    agentTools = agent.capabilities?.map(c => c.toLowerCase()) || []
  }

  // Check each agent pattern
  for (const [patternType, pattern] of Object.entries(AGENT_PATTERNS)) {
    // Check keyword matches
    const keywordMatches = pattern.keywords.filter(kw => lowerMessage.includes(kw.toLowerCase()))
    if (keywordMatches.length > 0) {
      const keywordScore = keywordMatches.length * 2 * pattern.priority
      score += keywordScore
      reasons.push(`Matched ${keywordMatches.length} keyword(s): ${keywordMatches.slice(0, 3).join(', ')}`)
    }

    // Check tool pattern matches
    const toolMatches = agentTools.filter(tool => 
      pattern.toolPatterns.some(pattern => tool.includes(pattern.toLowerCase()))
    )
    if (toolMatches.length > 0) {
      const toolScore = toolMatches.length * 5 * pattern.priority
      score += toolScore
      reasons.push(`Has matching tools: ${toolMatches.slice(0, 2).join(', ')}`)
    }

    // Check agent name pattern matches
    if (pattern.agentNamePatterns.some(p => agentName.includes(p.toLowerCase()))) {
      score += 10 * pattern.priority
      reasons.push(`Agent name matches pattern: ${patternType}`)
    }

    // Check description matches
    if (pattern.keywords.some(kw => agentDescription.includes(kw.toLowerCase()))) {
      score += 3 * pattern.priority
      reasons.push(`Description matches: ${patternType}`)
    }
  }

  // Attachment-based routing (existing logic)
  if (attachment) {
    if (attachment.type === 'image' || attachment.type === 'glazyr') {
      if (agentTools.some(t => t.includes('vision') || t.includes('image') || t.includes('analyze'))) {
        score += 50
        reasons.push('Has image analysis capabilities')
      }
    } else if (attachment.type === 'document') {
      if (agentTools.some(t => t.includes('document') || t.includes('analyze') || t.includes('extract'))) {
        score += 50
        reasons.push('Has document analysis capabilities')
      }
    }
  }

  // URL detection - strongly favor Playwright
  if (/https?:\/\/[^\s]+/i.test(message) || /\b(go to|navigate|visit|open|goto|avigate)\s+[^\s]+/i.test(message)) {
    if (agentTools.some(t => t.includes('browser') || t.includes('navigate') || t.includes('playwright'))) {
      score += 100
      reasons.push('URL detected - agent has browser capabilities')
    }
  }

  // Screenshot/capture keywords - strongly favor Playwright
  if (lowerMessage.includes('screenshot') || lowerMessage.includes('capture') || lowerMessage.includes('snapshot')) {
    if (agentTools.some(t => t.includes('screenshot') || t.includes('capture') || t.includes('snapshot'))) {
      score += 80
      reasons.push('Screenshot requested - agent has screenshot capabilities')
    }
  }

  // Page structure/content - favor Playwright
  if (lowerMessage.includes('page structure') || lowerMessage.includes('page content') || 
      lowerMessage.includes('accessibility') || lowerMessage.includes('dom')) {
    if (agentTools.some(t => t.includes('snapshot') || t.includes('accessibility') || t.includes('browser'))) {
      score += 70
      reasons.push('Page structure requested - agent has browser snapshot capabilities')
    }
  }

  return { score, reasons }
}

/**
 * Route a user message to the best agent
 */
export function routeToAgent(
  message: string,
  availableAgents: MCPAgent[],
  attachment?: { type: string },
  previousRoutingHistory?: Map<string, { success: boolean; agentId: string }>
): RoutingDecision {
  if (availableAgents.length === 0) {
    return {
      agent: null,
      agentName: 'No Agent Available',
      confidence: 0,
      reason: 'No agents available for routing',
    }
  }

  // Score all agents
  const scoredAgents = availableAgents
    .filter(agent => agent.status === 'online') // Only consider online agents
    .map(agent => {
      const { score, reasons } = scoreAgent(agent, message, attachment)
      
      // Boost score if this agent succeeded before for similar requests
      let historyBoost = 0
      if (previousRoutingHistory) {
        const history = Array.from(previousRoutingHistory.values())
        const successCount = history.filter(h => h.agentId === agent.id && h.success).length
        historyBoost = successCount * 5 // Small boost for previous success
      }

      return {
        agent,
        score: score + historyBoost,
        reasons,
      }
    })
    .sort((a, b) => b.score - a.score) // Sort by score descending

  if (scoredAgents.length === 0) {
    return {
      agent: null,
      agentName: 'No Online Agent',
      confidence: 0,
      reason: 'No online agents available',
    }
  }

  const bestMatch = scoredAgents[0]
  const maxScore = scoredAgents[0].score
  const secondBestScore = scoredAgents.length > 1 ? scoredAgents[1].score : 0

  // Calculate confidence based on score difference
  // If there's a clear winner (score difference > 20), high confidence
  // If scores are close, lower confidence
  const scoreDifference = maxScore - secondBestScore
  let confidence = 0.9
  if (scoreDifference < 10) {
    confidence = 0.5 // Close scores - uncertain
  } else if (scoreDifference < 30) {
    confidence = 0.7 // Somewhat confident
  }

  // If best score is very low, low confidence
  if (maxScore < 10) {
    confidence = 0.3
  }

  return {
    agent: bestMatch.agent,
    agentName: bestMatch.agent.name,
    confidence,
    reason: bestMatch.reasons.length > 0 
      ? bestMatch.reasons.slice(0, 2).join('; ')
      : `Selected based on agent capabilities (score: ${maxScore})`,
  }
}

/**
 * Get routing explanation for debugging
 */
export function explainRouting(
  message: string,
  availableAgents: MCPAgent[],
  attachment?: { type: string }
): {
  decision: RoutingDecision
  allScores: Array<{ agent: string; score: number; reasons: string[] }>
} {
  const decision = routeToAgent(message, availableAgents, attachment)
  
  const allScores = availableAgents
    .filter(agent => agent.status === 'online')
    .map(agent => {
      const { score, reasons } = scoreAgent(agent, message, attachment)
      return {
        agent: agent.name,
        score,
        reasons,
      }
    })
    .sort((a, b) => b.score - a.score)

  return { decision, allScores }
}
