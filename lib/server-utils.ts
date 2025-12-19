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

  // Extract endpoint from metadata or manifest
  let endpoint = ''
  
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
    console.warn(`No endpoint found for server ${server.serverId}, using serverId as fallback`)
    endpoint = server.serverId
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
