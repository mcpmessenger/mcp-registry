"use strict";
/**
 * Tool Context Types
 *
 * Defines the core responsibilities and output contexts for MCP tools
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_CONTEXTS = void 0;
exports.getToolContext = getToolContext;
exports.findToolsByOutputContext = findToolsByOutputContext;
exports.findToolsByResponsibility = findToolsByResponsibility;
exports.TOOL_CONTEXTS = {
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
};
/**
 * Get tool context by server ID or name
 */
function getToolContext(serverIdOrName) {
    const normalized = serverIdOrName.toLowerCase();
    // Check exact matches first
    if (exports.TOOL_CONTEXTS[normalized]) {
        return exports.TOOL_CONTEXTS[normalized];
    }
    // Check partial matches
    for (const [key, context] of Object.entries(exports.TOOL_CONTEXTS)) {
        if (normalized.includes(key) || context.tool.toLowerCase().includes(normalized)) {
            return context;
        }
    }
    return undefined;
}
/**
 * Find tools by output context
 */
function findToolsByOutputContext(outputContext) {
    return Object.values(exports.TOOL_CONTEXTS).filter(context => context.outputContext.toLowerCase().includes(outputContext.toLowerCase()));
}
/**
 * Find tools by core responsibility
 */
function findToolsByResponsibility(responsibility) {
    return Object.values(exports.TOOL_CONTEXTS).filter(context => context.coreResponsibility.toLowerCase().includes(responsibility.toLowerCase()));
}
//# sourceMappingURL=tool-context.js.map