import { prisma } from '../config/database'
import type { MCPServer, MCPTool } from '../types/mcp'

export class RegistryService {
  /**
   * Get all available MCP servers in v0.1 format
   */
  async getServers(): Promise<MCPServer[]> {
    const servers = await prisma.mcpServer.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return servers.map((server) => this.transformToMCPFormat(server))
  }

  /**
   * Get a specific server by ID
   */
  async getServerById(serverId: string): Promise<MCPServer | null> {
    const server = await prisma.mcpServer.findUnique({
      where: { serverId },
    })

    if (!server || !server.isActive) {
      return null
    }

    return this.transformToMCPFormat(server)
  }

  /**
   * Transform database model to MCP v0.1 format
   */
  private transformToMCPFormat(server: {
    serverId: string
    name: string
    description: string | null
    version: string
    command: string | null
    args: string | null
    env: string | null
    tools: string | null
    capabilities: string | null
  }): MCPServer {
    let tools: MCPTool[] = []
    if (server.tools) {
      try {
        tools = JSON.parse(server.tools) as MCPTool[]
      } catch (error) {
        console.error(`Failed to parse tools for server ${server.serverId}:`, error)
      }
    }

    let capabilities: string[] = []
    if (server.capabilities) {
      try {
        capabilities = JSON.parse(server.capabilities) as string[]
      } catch (error) {
        console.error(`Failed to parse capabilities for server ${server.serverId}:`, error)
      }
    }

    let args: string[] = []
    if (server.args) {
      try {
        args = JSON.parse(server.args) as string[]
      } catch (error) {
        console.error(`Failed to parse args for server ${server.serverId}:`, error)
      }
    }

    let env: Record<string, string> = {}
    if (server.env) {
      try {
        env = JSON.parse(server.env) as Record<string, string>
      } catch (error) {
        console.error(`Failed to parse env for server ${server.serverId}:`, error)
      }
    }

    return {
      serverId: server.serverId,
      name: server.name,
      description: server.description || undefined,
      version: server.version,
      command: server.command || undefined,
      args: args.length > 0 ? args : undefined,
      env: Object.keys(env).length > 0 ? env : undefined,
      tools,
      capabilities: capabilities.length > 0 ? capabilities : undefined,
    }
  }

  /**
   * Register a new MCP server
   */
  async registerServer(serverData: {
    serverId: string
    name: string
    description?: string
    version?: string
    command?: string
    args?: string[]
    env?: Record<string, string>
    tools?: MCPTool[]
    capabilities?: string[]
  }): Promise<MCPServer> {
    const server = await prisma.mcpServer.create({
      data: {
        serverId: serverData.serverId,
        name: serverData.name,
        description: serverData.description,
        version: serverData.version || 'v0.1',
        command: serverData.command,
        args: serverData.args ? JSON.stringify(serverData.args) : null,
        env: serverData.env ? JSON.stringify(serverData.env) : null,
        tools: serverData.tools ? JSON.stringify(serverData.tools) : null,
        capabilities: serverData.capabilities ? JSON.stringify(serverData.capabilities) : null,
      },
    })

    return this.transformToMCPFormat(server)
  }
}

export const registryService = new RegistryService()
