import assert from 'assert'
import { routeRequest } from '../tool-router'
import type { MCPServer } from '../api'

async function run() {
  const exa: MCPServer = {
    serverId: 'io.github.exa-labs/exa-mcp-server',
    name: 'Exa MCP Server',
    description: 'Exa search',
    version: '3.1.3',
    command: undefined,
    args: undefined,
    env: undefined,
    tools: [ { name: 'web_search_exa', description: 'Search', inputSchema: { type: 'object', properties: {} } } as any ],
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
    tools: [{ name: 'search', description: 'Generic search', inputSchema: { type: 'object', properties: {} } } as any],
    capabilities: ['tools'],
    metadata: undefined,
  }

  // Case 1: Concert query should prefer Exa when available
  const q1 = 'Find Iration concerts in Texas'
  const r1 = routeRequest(q1, [other, exa])
  assert(r1.primaryServer, 'Expected a primary server for concert query')
  assert(r1.primaryServer!.serverId === exa.serverId, `Expected Exa server, got ${r1.primaryServer!.serverId}`)

  // Case 2: Explicit site mention should avoid Exa preference
  const q2 = "Find Iration concerts in Texas using ticketmaster.com"
  const r2 = routeRequest(q2, [other, exa])
  assert(r2.primaryServer, 'Expected a primary server for explicit site query')
  // We expect the router to pick something other than Exa when a specific site is requested
  assert(r2.primaryServer!.serverId !== exa.serverId, 'Expected NOT to pick Exa for explicit site query')

  // Case 3: DEFAULT_SEARCH_SERVER_ID env var override
  process.env.DEFAULT_SEARCH_SERVER_ID = 'io.github.exa-labs/exa-mcp-server'
  const q3 = 'Search latest AI news'
  const r3 = routeRequest(q3, [other, exa])
  assert(r3.primaryServer, 'Expected primary server when DEFAULT_SEARCH_SERVER_ID is set')
  assert(r3.primaryServer!.serverId === exa.serverId, 'Expected Exa as defaultSearchServer')
  delete process.env.DEFAULT_SEARCH_SERVER_ID

  console.log('✅ Router unit tests passed')
}

run().catch(err => {
  console.error('Router tests failed:', err)
  process.exit(1)
})
