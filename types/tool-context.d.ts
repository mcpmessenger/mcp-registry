/**
 * Tool Context Types
 *
 * Defines the core responsibilities and output contexts for MCP tools
 */
export type ToolCoreResponsibility = "Factual Location" | "Real-time Extraction" | "Global News" | "The Orchestrator";
export type OutputContext = "Place IDs, Coordinates, Neighborhood Vibe" | "Live Prices, Hidden Rules, Contact Details" | "Trends, Alerts, Sentiment" | "Logical Synthesis, Calculations, Reports";
export interface ToolContext {
    tool: string;
    coreResponsibility: ToolCoreResponsibility;
    outputContext: OutputContext;
    description?: string;
    useCases?: string[];
}
export declare const TOOL_CONTEXTS: Record<string, ToolContext>;
/**
 * Get tool context by server ID or name
 */
export declare function getToolContext(serverIdOrName: string): ToolContext | undefined;
/**
 * Find tools by output context
 */
export declare function findToolsByOutputContext(outputContext: string): ToolContext[];
/**
 * Find tools by core responsibility
 */
export declare function findToolsByResponsibility(responsibility: string): ToolContext[];
//# sourceMappingURL=tool-context.d.ts.map