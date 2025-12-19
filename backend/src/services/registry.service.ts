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
   * Register/Publish a new MCP server to the registry
   * This implements the MCP v0.1 specification for publishing servers
   */
  async publishServer(serverData: {
    serverId: string
    name: string
    description?: string
    version?: string
    command?: string
    args?: string[]
    env?: Record<string, string>
    tools?: MCPTool[]
    capabilities?: string[]
    manifest?: Record<string, unknown>
    publishedBy?: string
    federationId?: string
    isPublic?: boolean
    metadata?: Record<string, unknown>
  }): Promise<MCPServer> {
    // Validate serverId format (should be like "io.github.mcpmessenger/mcp-server")
    if (!serverData.serverId || !/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(serverData.serverId)) {
      throw new Error('Invalid serverId format. Expected format: "org.name/server-name"')
    }

    // Validate tools and extract schemas for pre-validation
    const toolSchemas: Record<string, unknown> = {}
    if (serverData.tools && Array.isArray(serverData.tools)) {
      for (const tool of serverData.tools) {
        // Validate tool structure
        if (!tool.name || !tool.description || !tool.inputSchema) {
          throw new Error(`Invalid tool definition: ${tool.name || 'unnamed'}. Tools must have name, description, and inputSchema.`)
        }

        // Validate inputSchema is a valid JSON Schema
        if (tool.inputSchema.type !== 'object') {
          throw new Error(`Tool ${tool.name} inputSchema must have type "object"`)
        }

        // Store full schema for pre-validation
        toolSchemas[tool.name] = tool.inputSchema
      }
    }

    // Check if server already exists
    const existing = await prisma.mcpServer.findUnique({
      where: { serverId: serverData.serverId },
    })

    if (existing) {
      // Update existing server
      const updated = await prisma.mcpServer.update({
        where: { serverId: serverData.serverId },
        data: {
          name: serverData.name,
          description: serverData.description,
          version: serverData.version || existing.version,
          command: serverData.command ?? existing.command,
          args: serverData.args ? JSON.stringify(serverData.args) : existing.args,
          env: serverData.env ? JSON.stringify(serverData.env) : existing.env,
          tools: serverData.tools ? JSON.stringify(serverData.tools) : existing.tools,
          toolSchemas: Object.keys(toolSchemas).length > 0 ? JSON.stringify(toolSchemas) : existing.toolSchemas,
          capabilities: serverData.capabilities ? JSON.stringify(serverData.capabilities) : existing.capabilities,
          manifest: serverData.manifest ? JSON.stringify(serverData.manifest) : existing.manifest,
          isPublic: serverData.isPublic ?? existing.isPublic,
          federationId: serverData.federationId ?? existing.federationId,
          publishedBy: serverData.publishedBy ?? existing.publishedBy,
          publishedAt: new Date(),
          metadata: serverData.metadata ? JSON.stringify(serverData.metadata) : existing.metadata,
        },
      })

      return this.transformToMCPFormat(updated)
    } else {
      // Create new server
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
          toolSchemas: Object.keys(toolSchemas).length > 0 ? JSON.stringify(toolSchemas) : null,
          capabilities: serverData.capabilities ? JSON.stringify(serverData.capabilities) : null,
          manifest: serverData.manifest ? JSON.stringify(serverData.manifest) : null,
          isPublic: serverData.isPublic ?? true,
          federationId: serverData.federationId ?? null,
          publishedBy: serverData.publishedBy ?? null,
          metadata: serverData.metadata ? JSON.stringify(serverData.metadata) : null,
        },
      })

      return this.transformToMCPFormat(server)
    }
  }

  /**
   * Register a new MCP server (legacy method, kept for backward compatibility)
   * @deprecated Use publishServer instead
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
    return this.publishServer(serverData)
  }
}

export const registryService = new RegistryService()
