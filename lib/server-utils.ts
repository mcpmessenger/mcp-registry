/**
 * Utility functions to transform backend data to frontend format
 */

import type { MCPServer } from './api'
import type { MCPAgent } from '@/types/agent'

/**
 * Transform backend MCPServer to frontend MCPAgent format
 */
export function transformServerToAgent(server: MCPServer, index: number): MCPAgent {
  return {
    id: server.serverId || index.toString(),
    name: server.name,
    endpoint: server.serverId || '',
    status: 'online' as const, // Default to online, could check health in future
    lastActive: new Date(),
    capabilities: server.capabilities || server.tools.map(t => t.name) || [],
    manifest: JSON.stringify({
      name: server.name,
      version: server.version,
      description: server.description,
      tools: server.tools,
      capabilities: server.capabilities,
    }, null, 2),
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
