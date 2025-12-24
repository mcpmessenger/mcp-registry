/**
 * TypeScript types for MCP (Model Context Protocol) JSON-RPC messages
 */

export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: JSONRPCError;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPInitializeParams {
  protocolVersion: string;
  capabilities?: any;
  clientInfo?: {
    name: string;
    version: string;
  };
}

export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: any;
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface MCPToolInputProperty {
  type: string;
  description?: string;
  enum?: any[];
  [key: string]: any;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPToolsListResult {
  tools: MCPTool[];
}

export interface MCPToolCallParams {
  name: string;
  arguments?: any;
}

export interface MCPContent {
  type: string;
  text?: string;
  [key: string]: any;
}

export interface MCPToolCallResult {
  content: MCPContent[];
  isError?: boolean;
}

export interface MCPServer {
  serverId: string;
  name: string;
  description?: string;
  version: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  tools?: MCPTool[];
  capabilities?: string[];
  manifest?: any;
  metadata?: any;
  workflowState?: string;
  lockedBy?: string;
  workflowAttempts?: number;
  contextId?: string;
  workflowUpdatedAt?: Date;
}


