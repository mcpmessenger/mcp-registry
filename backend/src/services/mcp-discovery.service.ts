/**
 * MCP Discovery Service
 * 
 * Handles automatic discovery and registration of MCP servers for orchestrators.
 * Supports both polling-based and event-driven discovery patterns.
 */

import { registryService } from './registry.service'
import type { MCPServer } from '../types/mcp'
import { getToolContext } from '../../types/tool-context'

export interface EnhancedMCPServer extends MCPServer {
  toolContext?: {
    coreResponsibility: string
    outputContext: string
    description?: string
    useCases?: string[]
  }
  metadata?: Record<string, unknown> & {
    healthStatus?: 'healthy' | 'degraded' | 'unhealthy'
    lastChecked?: string
  }
  tools?: Array<MCPServer['tools'][0] & {
    toolContext?: {
      coreResponsibility: string
      outputContext: string
      description?: string
      useCases?: string[]
      whenToUse?: string
    }
  }>
}

export interface OrchestratorDiscoveryResponse {
  servers: EnhancedMCPServer[]
  lastUpdated: string
  totalServers: number
}

/**
 * Get servers enhanced with tool context for orchestrator discovery
 */
export async function getServersForOrchestrator(
  options?: { search?: string; capability?: string }
): Promise<OrchestratorDiscoveryResponse> {
  const servers = await registryService.getServers(options)
  
  const enhancedServers: EnhancedMCPServer[] = servers.map(server => {
    // Get tool context for this server
    const toolContext = getToolContext(server.serverId) || getToolContext(server.name)
    
    // Enhance each tool with tool context metadata
    const enhancedTools = server.tools?.map(tool => ({
      ...tool,
      toolContext: toolContext ? {
        coreResponsibility: toolContext.coreResponsibility,
        outputContext: toolContext.outputContext,
        description: toolContext.description,
        useCases: toolContext.useCases,
        whenToUse: toolContext.useCases?.[0] || toolContext.description,
      } : undefined,
    })) || []
    
    return {
      ...server,
      tools: enhancedTools,
      toolContext: toolContext ? {
        coreResponsibility: toolContext.coreResponsibility,
        outputContext: toolContext.outputContext,
        description: toolContext.description,
        useCases: toolContext.useCases,
      } : undefined,
      metadata: {
        ...server.metadata,
        healthStatus: 'healthy' as const, // TODO: Implement actual health checks
        lastChecked: new Date().toISOString(),
      },
    }
  })
  
  return {
    servers: enhancedServers,
    lastUpdated: new Date().toISOString(),
    totalServers: enhancedServers.length,
  }
}

/**
 * Emit discovery event when server is registered/updated
 * Can be used with Kafka or other event systems
 */
export interface MCPServerDiscoveryEvent {
  eventType: 'server.registered' | 'server.updated' | 'server.removed'
  serverId: string
  server: MCPServer | { serverId: string } // Full server for registered/updated, minimal for removed
  timestamp: string
  metadata?: {
    toolContext?: {
      coreResponsibility: string
      outputContext: string
    }
  }
}

/**
 * Create discovery event for Kafka/event stream
 */
export function createDiscoveryEvent(
  eventType: MCPServerDiscoveryEvent['eventType'],
  server: MCPServer | { serverId: string }
): MCPServerDiscoveryEvent {
  const toolContext = 'serverId' in server 
    ? (getToolContext(server.serverId) || getToolContext(server.name))
    : undefined
  
  return {
    eventType,
    serverId: server.serverId,
    server,
    timestamp: new Date().toISOString(),
    metadata: toolContext ? {
      toolContext: {
        coreResponsibility: toolContext.coreResponsibility,
        outputContext: toolContext.outputContext,
      },
    } : undefined,
  }
}

/**
 * Kafka producer for discovery events (if Kafka is configured)
 */
let kafkaProducer: any = null

export async function initializeKafkaProducer() {
  try {
    // Try to import kafkajs if available
    const { Kafka } = await import('kafkajs')
    const kafka = new Kafka({
      clientId: 'mcp-registry',
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    })
    
    kafkaProducer = kafka.producer()
    await kafkaProducer.connect()
    console.log('[MCP Discovery] Kafka producer connected')
  } catch (error) {
    console.warn('[MCP Discovery] Kafka not available, using event log only:', error instanceof Error ? error.message : 'Unknown error')
    kafkaProducer = null
  }
}

export async function emitDiscoveryEvent(event: MCPServerDiscoveryEvent) {
  // Emit to Kafka if available
  if (kafkaProducer) {
    try {
      await kafkaProducer.send({
        topic: 'mcp-server-events',
        messages: [{
          key: event.serverId,
          value: JSON.stringify(event),
          headers: {
            eventType: event.eventType,
            timestamp: event.timestamp,
          },
        }],
      })
      console.log(`[MCP Discovery] Emitted ${event.eventType} event for ${event.serverId}`)
    } catch (error) {
      console.error('[MCP Discovery] Failed to emit Kafka event:', error)
    }
  }
  
  // Also log to console for debugging
  console.log(`[MCP Discovery] Event: ${event.eventType} - ${event.serverId}`)
}

