/**
 * Utility functions to transform backend data to frontend format
 */

import type { MCPServer } from './api'
import type { MCPAgent } from '@/types/agent'

/**
 * Transform backend MCPServer to frontend MCPAgent format
 */
export function transformServerToAgent(server: MCPServer, index: number): MCPAgent {
  // Validate server has required fields
  if (!server || !server.serverId || !server.name) {
    console.warn('Invalid server data received:', server)
    throw new Error(`Invalid server data: missing serverId or name`)
  }

  // Check if this is a STDIO-based server (has command/args)
  const isStdioServer = server.command && server.args && server.args.length > 0
  
  // Extract endpoint from metadata or manifest (only needed for HTTP servers)
  let endpoint = ''
  
  if (!isStdioServer) {
    // Only HTTP servers need endpoints
    // Try metadata first (most reliable)
    if (server.metadata && typeof server.metadata === 'object') {
      const metadata = server.metadata as Record<string, unknown>
      if (typeof metadata.endpoint === 'string' && metadata.endpoint) {
        endpoint = metadata.endpoint
      }
    }
    
    // Fallback to manifest
    if (!endpoint && server.manifest && typeof server.manifest === 'object') {
      const manifest = server.manifest as Record<string, unknown>
      if (typeof manifest.endpoint === 'string' && manifest.endpoint) {
        endpoint = manifest.endpoint
      }
    }
    
    // Last resort: use serverId as endpoint (for local servers)
    if (!endpoint) {
      console.warn(`No endpoint found for HTTP server ${server.serverId}, using serverId as fallback`)
      endpoint = server.serverId
    }
  } else {
    // STDIO servers don't need endpoints - backend handles them
    // Use a special marker to indicate STDIO server
    endpoint = `stdio://${server.serverId}`
    console.log(`STDIO server detected: ${server.serverId} (command: ${server.command}, args: ${server.args?.join(' ')})`)
  }
  
  // Build manifest JSON (merge stored manifest with current server data)
  const manifestData = {
    name: server.name,
    version: server.version,
    description: server.description,
    tools: server.tools || [],
    capabilities: server.capabilities || [],
    serverId: server.serverId,
    endpoint: endpoint,
    ...(server.manifest && typeof server.manifest === 'object' ? server.manifest : {}),
  }
  
  return {
    id: server.serverId || index.toString(),
    name: server.name,
    endpoint: endpoint,
    status: 'online' as const, // Default to online, could check health in future
    lastActive: new Date(),
    capabilities: server.capabilities || server.tools?.map(t => t.name) || [],
    manifest: JSON.stringify(manifestData, null, 2),
    metadata: server.metadata,
    httpHeaders: server.metadata && typeof server.metadata === 'object' && (server.metadata as Record<string, unknown>).httpHeaders
      ? JSON.stringify((server.metadata as Record<string, unknown>).httpHeaders, null, 2)
      : undefined,
    metrics: {
      avgLatency: 0,
      p95Latency: 0,
      uptime: 100,
    },
  }
}

/**
 * Transform multiple servers to agents
 */
export function transformServersToAgents(servers: MCPServer[]): MCPAgent[] {
  return servers.map((server, index) => transformServerToAgent(server, index))
}

/**
 * Transform frontend MCPAgent back to backend MCPServer format
 * Used for install functionality
 */
export function transformAgentToServer(agent: MCPAgent): MCPServer {
  let manifest: Record<string, unknown> = {}
  try {
    manifest = JSON.parse(agent.manifest || '{}')
  } catch (e) {
    console.warn('Failed to parse agent manifest:', e)
  }

  // Extract command and args from manifest or metadata
  const command = manifest.command as string | undefined
  const args = manifest.args as string[] | undefined
  const env = manifest.env as Record<string, string> | undefined

  // Extract endpoint and determine if it's HTTP or STDIO
  const endpoint = agent.endpoint
  const isStdio = endpoint.startsWith('stdio://')

  return {
    serverId: agent.id,
    name: agent.name,
    description: manifest.description as string | undefined,
    version: (manifest.version as string) || 'v0.1',
    command: command || (isStdio ? 'npx' : undefined),
    args: args || (isStdio ? [] : undefined),
    env: env || {},
    tools: manifest.tools as MCPServer['tools'] || [],
    capabilities: agent.capabilities || [],
    manifest: manifest,
    metadata: agent.metadata || {},
  }
}
