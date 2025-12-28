import { routeRequest } from '../tool-router'
import type { MCPServer } from '../api'

const exa: MCPServer = {
  serverId: 'io.github.exa-labs/exa-mcp-server',
  name: 'Exa MCP Server',
  description: 'Exa search',
  version: '3.1.3',
  command: undefined,
  args: undefined,
  env: undefined,
  tools: [
    { name: 'web_search_exa', description: 'Search', inputSchema: { type: 'object', properties: {} } } as any,
    { name: 'get_code_context_exa', description: 'Code search', inputSchema: { type: 'object', properties: {} } } as any,
  ],
  capabilities: ['tools'],
  metadata: { npmPackage: 'exa-mcp-server', endpoint: 'https://mcp.exa.ai/mcp' } as any,
}

const other: MCPServer = {
  serverId: 'com.example/other-search',
  name: 'Other Search Server',
  description: 'Other',
  version: '0.1',
  command: undefined,
  args: undefined,
  env: undefined,
  tools: [{ name: 'search', description: 'Generic search' } as any],
  capabilities: ['tools'],
  metadata: undefined,
}

console.log(routeRequest('Find the latest news about AI', [other, exa]))
console.log(routeRequest('Search for best pizza in Austin', [other, exa]))
console.log(routeRequest('When is Iration playing in Texas', [other, exa]))
