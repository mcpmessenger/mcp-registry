/**
 * Tool Context Types
 * 
 * Defines the core responsibilities and output contexts for MCP tools
 */

export type ToolCoreResponsibility =
  | "Factual Location"
  | "Real-time Extraction"
  | "Global News"
  | "The Orchestrator"

export type OutputContext =
  | "Place IDs, Coordinates, Neighborhood Vibe"
  | "Live Prices, Hidden Rules, Contact Details"
  | "Trends, Alerts, Sentiment"
  | "Logical Synthesis, Calculations, Reports"

export interface ToolContext {
  tool: string
  coreResponsibility: ToolCoreResponsibility
  outputContext: OutputContext
  description?: string
  useCases?: string[]
}

export const TOOL_CONTEXTS: Record<string, ToolContext> = {
  "google-maps": {
    tool: "Google Maps",
    coreResponsibility: "Factual Location",
    outputContext: "Place IDs, Coordinates, Neighborhood Vibe",
    description: "Provides accurate geographic and location-based information",
    useCases: [
      "Location verification",
      "Geographic data retrieval",
      "Area analysis and context"
    ]
  },
  "playwright": {
    tool: "Playwright",
    coreResponsibility: "Real-time Extraction",
    outputContext: "Live Prices, Hidden Rules, Contact Details",
    description: "Extracts live data from web pages and captures dynamic content",
    useCases: [
      "Price monitoring",
      "Terms of service extraction",
      "Contact information gathering",
      "Dynamic content scraping"
    ]
  },
  "search": {
    tool: "Search",
    coreResponsibility: "Global News",
    outputContext: "Trends, Alerts, Sentiment",
    description: "Aggregates information from multiple sources and tracks current events",
    useCases: [
      "News aggregation",
      "Trend analysis",
      "Sentiment monitoring",
      "Alert systems"
    ]
  },
  "langchain": {
    tool: "LangChain",
    coreResponsibility: "The Orchestrator",
    outputContext: "Logical Synthesis, Calculations, Reports",
    description: "Coordinates multiple tools and synthesizes information from various inputs",
    useCases: [
      "Multi-tool orchestration",
      "Data synthesis",
      "Report generation",
      "Complex calculations"
    ]
  }
}

/**
 * Get tool context by server ID or name
 */
export function getToolContext(serverIdOrName: string): ToolContext | undefined {
  const normalized = serverIdOrName.toLowerCase()
  
  // Check exact matches first
  if (TOOL_CONTEXTS[normalized]) {
    return TOOL_CONTEXTS[normalized]
  }
  
  // Check partial matches
  for (const [key, context] of Object.entries(TOOL_CONTEXTS)) {
    if (normalized.includes(key) || context.tool.toLowerCase().includes(normalized)) {
      return context
    }
  }
  
  return undefined
}

