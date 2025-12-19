// MCP v0.1 Specification Types

export interface MCPServer {
  serverId: string // e.g., "io.github.mcpmessenger/mcp-server"
  name: string
  description?: string
  version: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  tools: MCPTool[]
  capabilities?: string[]
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: MCPToolInput
}

export interface MCPToolInput {
  type: 'object'
  properties: Record<string, MCPToolInputProperty>
  required?: string[]
}

export interface MCPToolInputProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description?: string
  enum?: (string | number)[]
  items?: MCPToolInputProperty // For array types
  properties?: Record<string, MCPToolInputProperty> // For object types
  required?: string[] // For object types
}

export interface MCPToolCall {
  name: string
  arguments: Record<string, unknown>
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}

export interface MCPServerManifest {
  name: string
  version: string
  description?: string
  tools?: MCPTool[]
  capabilities?: string[]
}
