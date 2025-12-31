import { prisma } from '../config/database'
import { serverIdentityService } from './server-identity.service'
import type { MCPServer, MCPTool } from '../types/mcp'
import { spawn } from 'child_process'

interface GetServersOptions {
  search?: string
  capability?: string
}

interface PublishServerData {
  serverId: string
  name: string
  description?: string
  version?: string
  command?: string | null
  args?: string[] | null
  env?: Record<string, string>
  tools?: MCPTool[]
  capabilities?: string[]
  manifest?: Record<string, any>
  metadata?: Record<string, any>
  isPublic?: boolean
  federationId?: string
  publishedBy?: string | null
  authConfig?: Record<string, any>
}

interface WorkflowState {
  workflowState: string | null
  lockedBy: string | null
  workflowAttempts: number
  contextId: string | null
  workflowUpdatedAt: Date | null
}

/**
 * Registry Service
 * 
 * Manages MCP server registration, discovery, and workflow state
 * Implements MCP v0.1 specification
 */
export class RegistryService {
  /**
   * Get all available MCP servers in v0.1 format
   * Supports filtering and searching as per MCP v0.1 specification
   */
  async getServers(options?: GetServersOptions): Promise<MCPServer[]> {
    const where: any = {
      isActive: true,
    }

    // Add search filter if provided
    if (options?.search) {
      const searchTerm = options.search
      // Use case-insensitive mode for PostgreSQL (schema default), fallback for SQLite
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { serverId: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }

    const servers = await prisma.mcpServer.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        serverId: true,
        name: true,
        description: true,
        version: true,
        command: true,
        args: true,
        env: true,
        tools: true,
        capabilities: true,
        manifest: true,
        metadata: true,
        workflowState: true,
        lockedBy: true,
        workflowAttempts: true,
        contextId: true,
        workflowUpdatedAt: true,
      },
    })

    // Transform and filter by capability if provided (post-query filter for JSON fields)
    let transformedServers = servers.map((server) => this.transformToMCPFormat(server))

    // Filter by capability if provided (capabilities is stored as JSON string)
    if (options?.capability) {
      transformedServers = transformedServers.filter((server) => {
        if (!server.capabilities || !Array.isArray(server.capabilities)) {
          return false
        }
        return server.capabilities.includes(options.capability!)
      })
    }

    return transformedServers
  }

  /**
   * Get a specific server by ID
   */
  async getServerById(serverId: string): Promise<MCPServer | null> {
    const server = await prisma.mcpServer.findUnique({
      where: { serverId },
      select: {
        serverId: true,
        name: true,
        description: true,
        version: true,
        command: true,
        args: true,
        env: true,
        tools: true,
        capabilities: true,
        manifest: true,
        metadata: true,
        isActive: true,
        workflowState: true,
        lockedBy: true,
        workflowAttempts: true,
        contextId: true,
        workflowUpdatedAt: true,
      },
    })

    if (!server || !server.isActive) {
      return null
    }

    return this.transformToMCPFormat(server)
  }

  /**
   * Transform database model to MCP v0.1 format
   */
  transformToMCPFormat(server: any): MCPServer {
    // Validate required fields
    if (!server.serverId || !server.name) {
      console.error('Invalid server data in transformToMCPFormat:', server)
      throw new Error(`Server missing required fields: serverId=${server.serverId}, name=${server.name}`)
    }

    let tools: MCPTool[] = []
    if (server.tools) {
      try {
        const parsed = JSON.parse(server.tools)
        tools = Array.isArray(parsed) ? parsed : []
      } catch (error) {
        console.error(`Failed to parse tools for server ${server.serverId}:`, error)
      }
    }

    let capabilities: string[] = []
    if (server.capabilities) {
      try {
        const parsed = JSON.parse(server.capabilities)
        capabilities = Array.isArray(parsed) ? parsed : []
      } catch (error) {
        console.error(`Failed to parse capabilities for server ${server.serverId}:`, error)
      }
    }

    let args: string[] = []
    if (server.args) {
      try {
        const parsed = JSON.parse(server.args)
        args = Array.isArray(parsed) ? parsed : []
      } catch (error) {
        console.error(`Failed to parse args for server ${server.serverId}:`, error)
      }
    }

    let env: Record<string, string> = {}
    if (server.env) {
      try {
        const parsed = JSON.parse(server.env)
        env = parsed && typeof parsed === 'object' ? parsed : {}
      } catch (error) {
        console.error(`Failed to parse env for server ${server.serverId}:`, error)
      }
    }

    let manifest: Record<string, any> | undefined
    if (server.manifest) {
      try {
        const parsed = JSON.parse(server.manifest)
        manifest = parsed && typeof parsed === 'object' ? parsed : undefined
      } catch (error) {
        console.error(`Failed to parse manifest for server ${server.serverId}:`, error)
      }
    }

    let metadata: Record<string, any> | undefined
    if (server.metadata) {
      try {
        const parsed = JSON.parse(server.metadata)
        metadata = parsed && typeof parsed === 'object' ? parsed : undefined
      } catch (error) {
        console.error(`Failed to parse metadata for server ${server.serverId}:`, error)
      }
    }

    // Add workflow state to metadata if present
    if (server.workflowState || server.lockedBy || server.workflowAttempts) {
      if (!metadata) {
        metadata = {}
      }
      metadata.workflow = {
        state: server.workflowState || null,
        lockedBy: server.lockedBy || null,
        attempts: server.workflowAttempts || 0,
        contextId: server.contextId || null,
        updatedAt: server.workflowUpdatedAt?.toISOString() || null,
      }
    }

    const result: MCPServer = {
      serverId: server.serverId,
      name: server.name,
      description: server.description || undefined,
      version: server.version || 'v0.1',
      command: server.command || undefined,
      args: args.length > 0 ? args : undefined,
      env: Object.keys(env).length > 0 ? env : undefined,
      tools: tools.length > 0 ? tools : [],
      capabilities: capabilities.length > 0 ? capabilities : undefined,
      manifest,
      metadata,
    }

    // Log transformation for debugging
    console.log(`Transformed server ${server.serverId}:`, {
      hasTools: (result.tools?.length ?? 0) > 0,
      hasManifest: !!result.manifest,
      hasMetadata: !!result.metadata,
      metadataEndpoint: result.metadata?.endpoint,
    })

    return result
  }

  /**
   * Register/Publish a new MCP server to the registry
   * This implements the MCP v0.1 specification for publishing servers
   */
  async publishServer(serverData: PublishServerData): Promise<MCPServer> {
    // Validate serverId format (should be like "io.github.mcpmessenger/mcp-server")
    if (!serverData.serverId || !/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(serverData.serverId)) {
      throw new Error('Invalid serverId format. Expected format: "org.name/server-name"')
    }

    // Validate tools and extract schemas for pre-validation
    const toolSchemas: Record<string, any> = {}
    if (serverData.tools && Array.isArray(serverData.tools)) {
      for (const tool of serverData.tools) {
        // Validate tool structure
        if (!tool.name || !tool.description || !tool.inputSchema) {
          throw new Error(
            `Invalid tool definition: ${tool.name || 'unnamed'}. Tools must have name, description, and inputSchema.`
          )
        }

        // Validate inputSchema is a valid JSON Schema
        if (tool.inputSchema.type !== 'object') {
          throw new Error(`Tool ${tool.name} inputSchema must have type "object"`)
        }

        // Store full schema for pre-validation
        toolSchemas[tool.name] = tool.inputSchema
      }
    }

    // Verify server identity if endpoint is available (SEP-1302)
    let identityVerification: {
      isValid: boolean
      error?: string
      publicKey?: string
      signature?: string
      manifest?: any
    } | null = null

    const metadata = serverData.metadata || {}
    const endpoint = metadata.endpoint as string | undefined

    if (endpoint) {
      try {
        console.log(`🔍 Verifying identity for server: ${serverData.serverId}`)
        identityVerification = await serverIdentityService.verifyServerIdentity(endpoint)
        if (identityVerification.isValid) {
          console.log(`✅ Identity verified for server: ${serverData.serverId}`)
        } else {
          console.warn(`⚠️  Identity verification failed for server: ${serverData.serverId}`, identityVerification.error)
        }
      } catch (error) {
        console.error(`❌ Error during identity verification for ${serverData.serverId}:`, error)
        // Continue with registration even if verification fails
      }
    }

    // Check if server already exists
    const existing = await prisma.mcpServer.findUnique({
      where: { serverId: serverData.serverId },
    })

    if (existing) {
      // Update existing server
      // For HTTP servers, command/args may be explicitly null to clear STDIO mode
      const updateData: any = {
        name: serverData.name,
        description: serverData.description,
        version: serverData.version || existing.version,
      }

      // Handle command: explicitly set if provided (including undefined for HTTP servers)
      // Check if command is explicitly provided (not just undefined from optional param)
      if (serverData.command !== undefined) {
        updateData.command = serverData.command || null
      } else {
        updateData.command = existing.command
      }

      // Handle args: explicitly set if provided (including undefined/empty for HTTP servers)
      if (serverData.args !== undefined) {
        updateData.args = serverData.args && serverData.args.length > 0 ? JSON.stringify(serverData.args) : null
      } else {
        updateData.args = existing.args
      }

      // Merge metadata instead of replacing it completely
      let mergedMetadata: Record<string, unknown> = {}
      if (existing.metadata) {
        try {
          mergedMetadata = JSON.parse(existing.metadata)
        } catch (e) {
          console.warn(`Failed to parse existing metadata for ${serverData.serverId}:`, e)
        }
      }
      if (serverData.metadata) {
        // Merge new metadata into existing (new values override existing)
        mergedMetadata = { ...mergedMetadata, ...serverData.metadata }
      }
      
      const updatePayload: any = {
        ...updateData,
        env: serverData.env ? JSON.stringify(serverData.env) : existing.env,
        tools: serverData.tools ? JSON.stringify(serverData.tools) : existing.tools,
        toolSchemas: Object.keys(toolSchemas).length > 0 ? JSON.stringify(toolSchemas) : existing.toolSchemas,
        capabilities: serverData.capabilities ? JSON.stringify(serverData.capabilities) : existing.capabilities,
        manifest: serverData.manifest ? JSON.stringify(serverData.manifest) : existing.manifest,
        isPublic: serverData.isPublic ?? existing.isPublic,
        federationId: serverData.federationId ?? existing.federationId,
        publishedBy: serverData.publishedBy ?? existing.publishedBy,
        publishedAt: new Date(),
        metadata: Object.keys(mergedMetadata).length > 0 ? JSON.stringify(mergedMetadata) : existing.metadata,
        authConfig: serverData.authConfig ? JSON.stringify(serverData.authConfig) : existing.authConfig,
      }

      // Add identity verification data if available
      if (identityVerification) {
        updatePayload.identityVerified = identityVerification.isValid
        updatePayload.identityVerifiedAt = identityVerification.isValid ? new Date() : existing.identityVerifiedAt
        updatePayload.identityPublicKey = identityVerification.publicKey || existing.identityPublicKey
        updatePayload.identitySignature = identityVerification.signature || existing.identitySignature
        updatePayload.identityUrl = endpoint || existing.identityUrl
      }

      const updated = await prisma.mcpServer.update({
        where: { serverId: serverData.serverId },
        data: updatePayload,
      })

      // Emit discovery event for orchestrators (Kafka/webhook)
      try {
        const { createDiscoveryEvent, emitDiscoveryEvent } = await import('./mcp-discovery.service')
        const event = createDiscoveryEvent('server.updated', this.transformToMCPFormat(updated))
        await emitDiscoveryEvent(event)
      } catch (error) {
        console.warn('[Registry] Failed to emit discovery event:', error)
        // Don't fail the update if event emission fails
      }

      return this.transformToMCPFormat(updated)
    } else {
      // Create new server
      // Generate a unique ID (use serverId as the ID since it's also unique)
      const id = serverData.serverId
      
      const createData: any = {
        id: id, // Required by Prisma schema
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
        authConfig: serverData.authConfig ? JSON.stringify(serverData.authConfig) : null,
      }

      // Add identity verification data if available
      if (identityVerification) {
        createData.identityVerified = identityVerification.isValid
        createData.identityVerifiedAt = identityVerification.isValid ? new Date() : null
        createData.identityPublicKey = identityVerification.publicKey || null
        createData.identitySignature = identityVerification.signature || null
        createData.identityUrl = endpoint || null
      }

      const server = await prisma.mcpServer.create({
        data: createData,
      })

      // For STDIO servers, discover tools after registration
      if (serverData.command && serverData.args) {
        try {
          console.log(`[Registry] Discovering tools for STDIO server: ${serverData.serverId}`)
          const discoveredTools = await this.discoverStdioTools(serverData)
          if (discoveredTools && discoveredTools.length > 0) {
            console.log(`[Registry] Discovered ${discoveredTools.length} tools for ${serverData.serverId}`)
            // Update server with discovered tools
            await prisma.mcpServer.update({
              where: { serverId: serverData.serverId },
              data: {
                tools: JSON.stringify(discoveredTools),
              },
            })
            // Return updated server with tools
            const updatedServer = await prisma.mcpServer.findUnique({
              where: { serverId: serverData.serverId },
            })
            if (updatedServer) {
              return this.transformToMCPFormat(updatedServer)
            }
          }
        } catch (error: any) {
          // Check if it's an expected error (package not found, missing env var, etc.)
          const errorMessage = error?.message || String(error) || ''
          const stderrMessage = error?.stderr || ''
          const fullError = `${errorMessage} ${stderrMessage}`.toLowerCase()
          
          const isExpectedError = 
            fullError.includes('404') || 
            fullError.includes('not found') ||
            fullError.includes('is not in this registry') ||
            fullError.includes('e404') ||
            fullError.includes('environment variable is not set') ||
            fullError.includes('missing required') ||
            fullError.includes('exited with code 1')
          
          if (isExpectedError) {
            // Provide more specific error message
            if (fullError.includes('environment variable') || fullError.includes('not set')) {
              console.log(`[Registry] Tool discovery skipped for ${serverData.serverId}: requires environment variables (tools will be discovered when env vars are configured)`)
            } else if (fullError.includes('404') || fullError.includes('not found')) {
              console.log(`[Registry] Tool discovery skipped for ${serverData.serverId}: npm package not found (this is expected if package doesn't exist yet)`)
            } else {
              console.log(`[Registry] Tool discovery skipped for ${serverData.serverId}: ${errorMessage.substring(0, 100)}`)
            }
          } else {
            console.error(`[Registry] Failed to discover tools for ${serverData.serverId}:`, error)
          }
          // Continue even if tool discovery fails - server is still registered
        }
      } else if (serverData.metadata && typeof serverData.metadata === 'object') {
        // For HTTP servers, attempt tool discovery if endpoint is configured
        const metadata = serverData.metadata as Record<string, unknown>
        if (metadata.endpoint && typeof metadata.endpoint === 'string') {
          try {
            console.log(`[Registry] Discovering tools for HTTP server: ${serverData.serverId}`)
            // Get the saved server to pass to discoverHttpTools
            const savedServer = await prisma.mcpServer.findUnique({
              where: { serverId: serverData.serverId },
            })
            if (savedServer) {
              const discoveredTools = await this.discoverHttpTools(savedServer)
              if (discoveredTools && discoveredTools.length > 0) {
                console.log(`[Registry] Discovered ${discoveredTools.length} tools for HTTP server ${serverData.serverId}`)
                // Return updated server with tools (already updated by discoverHttpTools)
                const updatedServer = await prisma.mcpServer.findUnique({
                  where: { serverId: serverData.serverId },
                })
                if (updatedServer) {
                  return this.transformToMCPFormat(updatedServer)
                }
              }
            }
          } catch (error: any) {
            const errorMessage = error?.message || String(error) || ''
            const fullError = errorMessage.toLowerCase()
            
            // Expected errors for HTTP servers
            const isExpectedError = 
              fullError.includes('403') ||
              fullError.includes('401') ||
              fullError.includes('permission denied') ||
              fullError.includes('api key') ||
              fullError.includes('authentication') ||
              fullError.includes('endpoint') ||
              fullError.includes('timeout')
            
            if (isExpectedError) {
              if (fullError.includes('api key') || fullError.includes('403') || fullError.includes('401')) {
                console.log(`[Registry] Tool discovery skipped for ${serverData.serverId}: requires API key/authentication (tools will be discovered when API key is configured)`)
              } else {
                console.log(`[Registry] Tool discovery skipped for ${serverData.serverId}: ${errorMessage.substring(0, 100)}`)
              }
            } else {
              console.error(`[Registry] Failed to discover tools for HTTP server ${serverData.serverId}:`, error)
            }
            // Continue even if tool discovery fails - server is still registered
          }
        }
      }

      // Return the created server (transformed to MCP format)
      return this.transformToMCPFormat(server)
    }
  }

  /**
   * Manually discover tools for an existing server (STDIO or HTTP)
   */
  async discoverToolsForServer(serverId: string): Promise<MCPTool[]> {
    const server = await prisma.mcpServer.findUnique({
      where: { serverId },
    })

    if (!server) {
      throw new Error(`Server ${serverId} not found`)
    }

    // Check if it's an HTTP server
    if (!server.command || !server.args) {
      // HTTP server - discover tools via HTTP endpoint
      return this.discoverHttpTools(server)
    }

    const serverData: PublishServerData = {
      serverId: server.serverId,
      name: server.name,
      description: server.description || undefined,
      version: server.version,
      command: server.command,
      args: server.args ? JSON.parse(server.args) : [],
      env: server.env ? JSON.parse(server.env) : undefined,
    }

    const discoveredTools = await this.discoverStdioTools(serverData)
    
    if (discoveredTools && discoveredTools.length > 0) {
      // Update server with discovered tools
      await prisma.mcpServer.update({
        where: { serverId },
        data: {
          tools: JSON.stringify(discoveredTools),
        },
      })
    }

    return discoveredTools
  }

  /**
   * Discover tools from an HTTP MCP server by calling tools/list via HTTP
   */
  private async discoverHttpTools(server: any): Promise<MCPTool[]> {
    // Get endpoint from metadata or manifest
    let endpoint: string | null = null
    
    if (server.metadata) {
      try {
        const metadata = JSON.parse(server.metadata)
        if (metadata.endpoint && typeof metadata.endpoint === 'string') {
          endpoint = metadata.endpoint
        }
      } catch (e) {
        // Metadata parse failed
      }
    }
    
    if (!endpoint && server.manifest) {
      try {
        const manifest = JSON.parse(server.manifest)
        if (manifest.endpoint && typeof manifest.endpoint === 'string') {
          endpoint = manifest.endpoint
        }
      } catch (e) {
        // Manifest parse failed
      }
    }
    
    if (!endpoint) {
      throw new Error(`HTTP server ${server.serverId} has no endpoint configured`)
    }

    // Get HTTP headers from metadata
    let httpHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (server.metadata) {
      try {
        const metadata = JSON.parse(server.metadata)
        if (metadata.httpHeaders && typeof metadata.httpHeaders === 'object') {
          Object.assign(httpHeaders, metadata.httpHeaders)
        }
      } catch (e) {
        // Metadata parse failed
      }
    }

    try {
      console.log(`[Tool Discovery] Discovering tools for HTTP server: ${server.serverId} at ${endpoint}`)
      console.log(`[Tool Discovery] HTTP Headers:`, Object.keys(httpHeaders).join(', '))
      if (httpHeaders['X-Goog-Api-Key']) {
        console.log(`[Tool Discovery] Google Maps API key present: ${httpHeaders['X-Goog-Api-Key'].substring(0, 10)}...`)
      }
      
      // For Google Maps and similar servers, try tools/list directly (they may not need initialize)
      // Try tools/list first (simpler, works for most HTTP MCP servers)
      let toolsResponse: Response
      let toolsData: any
      
      try {
        toolsResponse = await fetch(endpoint, {
          method: 'POST',
          headers: httpHeaders,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list',
            params: {},
          }),
        })

        if (!toolsResponse.ok) {
          const errorText = await toolsResponse.text()
          console.error(`[Tool Discovery] HTTP ${toolsResponse.status} error:`, errorText.substring(0, 200))
          
          // Provide helpful error messages
          if (toolsResponse.status === 403) {
            throw new Error(`403 Forbidden: API key may be missing or invalid. Check HTTP Headers configuration in registry.`)
          } else if (toolsResponse.status === 401) {
            throw new Error(`401 Unauthorized: Authentication required. Check API key configuration.`)
          } else if (toolsResponse.status === 404) {
            throw new Error(`404 Not Found: Endpoint may be incorrect: ${endpoint}`)
          } else {
            throw new Error(`HTTP ${toolsResponse.status}: ${toolsResponse.statusText}. ${errorText.substring(0, 100)}`)
          }
        }

        toolsData = await toolsResponse.json()
        
        if (toolsData.error) {
          const errorMsg = toolsData.error.message || JSON.stringify(toolsData.error)
          console.error(`[Tool Discovery] MCP error:`, errorMsg)
          
          // Provide helpful error messages for common MCP errors
          if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('403')) {
            throw new Error(`Permission denied: API key may be missing or invalid. Check HTTP Headers: {"X-Goog-Api-Key": "YOUR_KEY"}`)
          } else if (errorMsg.includes('API key')) {
            throw new Error(`API key error: ${errorMsg}`)
          } else {
            throw new Error(`MCP error: ${errorMsg}`)
          }
        }

        const tools = toolsData.result?.tools || []
        console.log(`[Tool Discovery] Discovered ${tools.length} tools for HTTP server ${server.serverId}`)
        
        if (tools.length === 0) {
          console.warn(`[Tool Discovery] No tools found for ${server.serverId}. Server may not be fully configured.`)
        }
        
        // Update server with discovered tools
        await prisma.mcpServer.update({
          where: { serverId: server.serverId },
          data: {
            tools: JSON.stringify(tools),
          },
        })
        
        return tools
      } catch (directError: any) {
        // If direct tools/list fails, try initialize first (for servers that require it)
        console.log(`[Tool Discovery] Direct tools/list failed, trying initialize first...`)
        
        const initResponse = await fetch(endpoint, {
          method: 'POST',
          headers: httpHeaders,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: {
                name: 'mcp-registry',
                version: '1.0.0',
              },
            },
          }),
        })

        if (!initResponse.ok) {
          const errorText = await initResponse.text()
          throw new Error(`Initialize failed (HTTP ${initResponse.status}): ${errorText.substring(0, 200)}. Original error: ${directError.message}`)
        }

        const initData = await initResponse.json() as { error?: { message?: string } }
        if (initData.error) {
          throw new Error(`Initialize error: ${initData.error.message || JSON.stringify(initData.error)}. Original error: ${directError.message}`)
        }

        // Now try tools/list after initialize
        toolsResponse = await fetch(endpoint, {
          method: 'POST',
          headers: httpHeaders,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {},
          }),
        })

        if (!toolsResponse.ok) {
          const errorText = await toolsResponse.text()
          throw new Error(`tools/list failed after initialize (HTTP ${toolsResponse.status}): ${errorText.substring(0, 200)}`)
        }

        toolsData = await toolsResponse.json()
        if (toolsData.error) {
          throw new Error(`tools/list error: ${toolsData.error.message || JSON.stringify(toolsData.error)}`)
        }

        const tools = toolsData.result?.tools || []
        console.log(`[Tool Discovery] Discovered ${tools.length} tools for HTTP server ${server.serverId} (after initialize)`)
        
        // Update server with discovered tools
        await prisma.mcpServer.update({
          where: { serverId: server.serverId },
          data: {
            tools: JSON.stringify(tools),
          },
        })
        
        return tools
      }
    } catch (error: any) {
      const errorMessage = error?.message || String(error) || 'Unknown error'
      console.error(`[Tool Discovery] Failed to discover tools for HTTP server ${server.serverId}:`, errorMessage)
      console.error(`[Tool Discovery] Endpoint: ${endpoint}`)
      console.error(`[Tool Discovery] Headers configured:`, Object.keys(httpHeaders).join(', '))
      
      // Re-throw with more context
      throw new Error(`HTTP tool discovery failed for ${server.serverId}: ${errorMessage}`)
    }
  }

  /**
   * Discover tools from a STDIO MCP server by spawning it and calling tools/list
   */
  private async discoverStdioTools(serverData: PublishServerData): Promise<MCPTool[]> {
    return new Promise((resolve, reject) => {
      if (!serverData.command || !serverData.args) {
        resolve([])
        return
      }

      const args = serverData.args
      // Filter out undefined values from process.env and convert to Record<string, string>
      const env: Record<string, string> = {}
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          env[key] = value
        }
      }
      if (serverData.env) {
        Object.assign(env, serverData.env)
      }

      console.log(`[Tool Discovery] Spawning: ${serverData.command} ${args.join(' ')}`)
      const proc = spawn(serverData.command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env,
      })

      let stdoutBuffer = ''
      let requestId = 1
      const timeout = 30000 // 30 second timeout for discovery
      let timeoutId: NodeJS.Timeout
      let initialized = false

      // Handle stdout
      proc.stdout?.on('data', (data: Buffer) => {
        stdoutBuffer += data.toString()
        const lines = stdoutBuffer.split('\n')
        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line)
              // Handle initialize response (requestId = 1)
              if (message.id === 1 && !initialized) {
                if (message.error) {
                  clearTimeout(timeoutId)
                  proc.kill()
                  reject(new Error(`MCP initialize error: ${message.error.message || JSON.stringify(message.error)}`))
                  return
                }
                if (message.result) {
                  // Initialize successful, now request tools/list
                  initialized = true
                  requestId = 2
                  const toolsListRequest = {
                    jsonrpc: '2.0',
                    id: requestId,
                    method: 'tools/list',
                    params: {},
                  }
                  proc.stdin?.write(JSON.stringify(toolsListRequest) + '\n')
                }
              }
              // Handle tools/list response (requestId = 2)
              else if (message.id === 2 && initialized) {
                if (message.error) {
                  clearTimeout(timeoutId)
                  proc.kill()
                  reject(new Error(`MCP tools/list error: ${message.error.message || JSON.stringify(message.error)}`))
                  return
                }
                if (message.result) {
                  // This is the tools/list response
                  clearTimeout(timeoutId)
                  proc.kill()
                  const tools = message.result.tools || []
                  resolve(tools)
                  return
                }
              }
            } catch (e) {
              // Not a complete JSON message yet, continue accumulating
            }
          }
        }
      })

      // Handle stderr - collect it for error messages
      let stderrBuffer = ''
      proc.stderr?.on('data', (data: Buffer) => {
        const message = data.toString()
        stderrBuffer += message
        if (!message.includes('Downloading') && !message.includes('Installing') && !message.includes('npm notice')) {
          console.log(`[Tool Discovery stderr]:`, message.trim())
        }
      })

      // Handle errors
      proc.on('error', (error) => {
        clearTimeout(timeoutId)
        reject(new Error(`Failed to spawn process: ${error.message}`))
      })

      proc.on('exit', (code) => {
        clearTimeout(timeoutId)
        if (code !== 0 && code !== null && !initialized) {
          // Process exited before initialization - likely due to missing env vars or other startup error
          const errorMsg = stderrBuffer || `Process exited with code ${code}`
          reject(new Error(`Tool discovery failed: ${errorMsg.substring(0, 200)}`))
        }
      })

      // Send initialize request
      const initRequest = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'mcp-registry-backend',
            version: '1.0.0',
          },
        },
      }

      proc.stdin?.write(JSON.stringify(initRequest) + '\n')
      proc.stdin?.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')

      // Set timeout
      timeoutId = setTimeout(() => {
        proc.kill()
        console.warn(`[Tool Discovery] Timeout for ${serverData.serverId}`)
        resolve([]) // Return empty array on timeout rather than rejecting
      }, timeout)
    })
  }

  /**
   * Delete an MCP server from the registry
   * Soft delete by setting isActive to false
   */
  async deleteServer(serverId: string): Promise<void> {
    const server = await prisma.mcpServer.findUnique({
      where: { serverId },
    })

    if (!server) {
      throw new Error(`Server ${serverId} not found`)
    }

    // Emit discovery event before deletion
    try {
      const { createDiscoveryEvent, emitDiscoveryEvent } = await import('./mcp-discovery.service')
      const event = createDiscoveryEvent('server.removed', { serverId })
      await emitDiscoveryEvent(event)
    } catch (error) {
      console.warn('[Registry] Failed to emit discovery event for deletion:', error)
      // Continue with deletion even if event emission fails
    }

    // Soft delete by setting isActive to false
    await prisma.mcpServer.update({
      where: { serverId },
      data: { isActive: false },
    })
  }

  /**
   * Register a new MCP server (legacy method, kept for backward compatibility)
   * @deprecated Use publishServer instead
   */
  async registerServer(serverData: PublishServerData): Promise<MCPServer> {
    return this.publishServer(serverData)
  }

  /**
   * Workflow State Machine Methods
   * These methods manage workflow state transitions for orchestration
   */

  /**
   * Lock a server for a workflow and set initial state
   */
  async lockWorkflow(serverId: string, state: string, lockedBy: string, contextId?: string): Promise<void> {
    await prisma.mcpServer.update({
      where: { serverId },
      data: {
        workflowState: state,
        lockedBy,
        contextId: contextId || null,
        workflowAttempts: 0,
        workflowUpdatedAt: new Date(),
      },
    })
  }

  /**
   * Transition workflow state
   */
  async transitionWorkflowState(serverId: string, newState: string, lockedBy?: string): Promise<void> {
    const updateData: any = {
      workflowState: newState,
      workflowUpdatedAt: new Date(),
    }

    if (lockedBy) {
      updateData.lockedBy = lockedBy
    }

    // Clear lock if state indicates completion or failure
    if (newState.includes('Completed') || newState.includes('Failed') || newState === 'PlanB') {
      updateData.lockedBy = null
    }

    await prisma.mcpServer.update({
      where: { serverId },
      data: updateData,
    })
  }

  /**
   * Unlock workflow (clear lock and reset attempts)
   */
  async unlockWorkflow(serverId: string): Promise<void> {
    await prisma.mcpServer.update({
      where: { serverId },
      data: {
        lockedBy: null,
        workflowAttempts: 0,
        workflowUpdatedAt: new Date(),
      },
    })
  }

  /**
   * Increment workflow retry attempts
   */
  async incrementWorkflowAttempts(serverId: string): Promise<number> {
    const server = await prisma.mcpServer.findUnique({
      where: { serverId },
      select: { workflowAttempts: true },
    })

    if (!server) {
      throw new Error(`Server ${serverId} not found`)
    }

    const newAttempts = server.workflowAttempts + 1

    await prisma.mcpServer.update({
      where: { serverId },
      data: {
        workflowAttempts: newAttempts,
        workflowUpdatedAt: new Date(),
      },
    })

    return newAttempts
  }

  /**
   * Get workflow state for a server
   */
  async getWorkflowState(serverId: string): Promise<WorkflowState | null> {
    const server = await prisma.mcpServer.findUnique({
      where: { serverId },
      select: {
        workflowState: true,
        lockedBy: true,
        workflowAttempts: true,
        contextId: true,
        workflowUpdatedAt: true,
      },
    })

    if (!server) {
      return null
    }

    return {
      workflowState: server.workflowState,
      lockedBy: server.lockedBy,
      workflowAttempts: server.workflowAttempts,
      contextId: server.contextId,
      workflowUpdatedAt: server.workflowUpdatedAt,
    }
  }
}

export const registryService = new RegistryService()

