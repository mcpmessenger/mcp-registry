import { Router } from 'express'
import { z } from 'zod'
import { registryService } from '../../services/registry.service'
import { authenticateUser } from '../../middleware/auth.middleware'
import { installConfigService, type InstallClient } from '../../services/install-config.service'
import { mcpInvokeService } from '../../services/mcp-invoke.service'
import type { MCPServer, MCPTool, MCPToolInputProperty } from '../../types/mcp'

const router = Router()

/**
 * GET /v0.1/servers
 * Returns a JSON list of available MCP servers
 * Supports query parameters for filtering and searching
 * This is the "App Store" entry point for the frontend
 * Complies with MCP v0.1 specification
 * 
 * Query parameters:
 * - search: Search term to filter servers by name or description
 * - capability: Filter by capability (e.g., "tools", "resources", "prompts")
 * - for_orchestrator: If true, returns enhanced format with tool context for orchestrators
 */
router.get('/servers', async (req, res, next) => {
  try {
    const { search, capability, for_orchestrator } = req.query
    const options = {
      search: typeof search === 'string' ? search : undefined,
      capability: typeof capability === 'string' ? capability : undefined,
    }
    
    // If for_orchestrator=true, use discovery service for enhanced format
    if (for_orchestrator === 'true') {
      const { getServersForOrchestrator } = await import('../../services/mcp-discovery.service')
      const discoveryResponse = await getServersForOrchestrator(options)
      return res.json(discoveryResponse)
    }
    
    // Standard response for frontend
    const servers = await registryService.getServers(options)
    res.json(servers)
  } catch (error) {
    next(error)
  }
})

// Debug endpoint - simple and direct
// Use regex to match serverId with dots and slashes (e.g., com.google/maps-mcp)
router.get(/^\/debug\/server\/(.+)$/, async (req, res, next) => {
  try {
    // Extract serverId from the regex match
    const serverId = req.params[0] || req.path.replace('/debug/server/', '')
    console.log('[Servers Router] Extracted serverId:', serverId)
    const server = await registryService.getServerById(serverId)
    
    if (!server) {
      return res.status(404).json({ success: false, error: `Server ${serverId} not found` })
    }

    const metadata = server.metadata as Record<string, unknown> | undefined
    const httpHeaders = metadata?.httpHeaders as Record<string, unknown> | undefined

    res.json({
      success: true,
      server: {
        serverId: server.serverId,
        name: server.name,
        endpoint: metadata?.endpoint,
        hasMetadata: !!metadata,
        hasHttpHeaders: !!httpHeaders,
        httpHeaders: httpHeaders ? Object.keys(httpHeaders) : [],
        httpHeadersPreview: httpHeaders ? Object.fromEntries(
          Object.entries(httpHeaders).map(([key, value]) => [
            key,
            typeof value === 'string' && key.toLowerCase().includes('key')
              ? `${String(value).substring(0, 10)}...` 
              : value
          ])
        ) : null,
        metadataKeys: metadata ? Object.keys(metadata) : [],
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /v0.1/servers/:serverId
 * Get a specific server by ID
 * Complies with MCP v0.1 specification
 */
router.get('/servers/:serverId', async (req, res, next) => {
  try {
    const { serverId } = req.params
    const server = await registryService.getServerById(serverId)

    if (!server) {
      return res.status(404).json({
        error: 'Server not found',
        serverId,
      })
    }

    res.json(server)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /v0.1/publish
 * Publish/register a new MCP server to the registry
 * 
 * This endpoint strictly adheres to the MCP v0.1 specification and acts as
 * the canonical "App Store" publishing endpoint. It validates tool schemas
 * and ensures compatibility with major AI hosts like VS Code and Claude Desktop.
 * 
 * Note: The official registry uses GitHub OAuth for authentication via mcp-publisher CLI.
 * This implementation supports both CLI and direct API access.
 * 
 * Request body must conform to MCPServer interface:
 * {
 *   "serverId": "io.github.mcpmessenger/mcp-server",
 *   "name": "Server Name",
 *   "description": "Optional description",
 *   "version": "v0.1",
 *   "command": "node",
 *   "args": ["server.js"],
 *   "env": { "API_KEY": "value" },
 *   "tools": [
 *     {
 *       "name": "generate_svg",
 *       "description": "Generate SVG",
 *       "inputSchema": {
 *         "type": "object",
 *         "properties": { ... }
 *       }
 *     }
 *   ],
 *   "capabilities": ["tools"]
 * }
 */
const publishServerSchema = z.object({
  serverId: z.string().regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/, {
    message: 'serverId must follow format: "org.name/server-name"',
  }),
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().default('v0.1'),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  tools: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string().min(1),
      inputSchema: z.object({
        type: z.literal('object'),
        properties: z.record(z.any()).optional(),
        required: z.array(z.string()).optional(),
      }),
    })
  ).optional(),
  capabilities: z.array(z.string()).optional(),
  manifest: z.record(z.any()).optional(),
  publishedBy: z.string().optional(),
  federationId: z.string().optional(),
  isPublic: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
})

router.post('/publish', authenticateUser, async (req, res, next) => {
  try {
    console.log('[Publish] Received request:', JSON.stringify(req.body, null, 2))
    
    // Validate request body
    const validated = publishServerSchema.parse(req.body)
    console.log('[Publish] Validated data:', {
      serverId: validated.serverId,
      name: validated.name,
      hasCommand: !!validated.command,
      hasArgs: !!validated.args,
      hasEnv: !!validated.env,
    })

    // Extract publishedBy from authenticated user or fallback
    let publishedBy: string
    if (req.user) {
      // Use authenticated user's email or userId
      publishedBy = validated.publishedBy || req.user.email || req.user.userId
    } else {
      // Fallback to header or anonymous
      const headerUserId = req.headers['x-user-id']
      const normalizedUserId = Array.isArray(headerUserId) ? headerUserId[0] : headerUserId
      publishedBy = validated.publishedBy || normalizedUserId || 'anonymous'
    }

    const normalizedTools: MCPTool[] | undefined = validated.tools?.map((tool) => ({
      ...tool,
      inputSchema: {
        ...tool.inputSchema,
        properties:
          (tool.inputSchema.properties as Record<string, MCPToolInputProperty>) || undefined,
      },
    }))

    console.log('[Publish] Calling registryService.publishServer...')
    const server = await registryService.publishServer({
      ...validated,
      tools: normalizedTools,
      publishedBy,
    })
    console.log('[Publish] Server published successfully:', server.serverId)

    res.status(200).json({
      success: true,
      message: 'Server published successfully',
      server,
    })
  } catch (error) {
    console.error('[Publish] Error caught:', error)
    
    if (error instanceof z.ZodError) {
      console.error('[Publish] Validation error:', error.errors)
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      })
    }

    // Check for duplicate serverId
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      console.error('[Publish] Duplicate serverId error')
      return res.status(409).json({
        success: false,
        error: 'Server with this serverId already exists',
      })
    }

    // Log the actual error for debugging
    if (error instanceof Error) {
      console.error('[Publish] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'An error occurred',
      })
    }

    next(error)
  }
})

/**
 * PUT /v0.1/servers/:serverId
 * Update an existing MCP server
 */
router.put('/servers/:serverId', authenticateUser, async (req, res, next) => {
  try {
    const { serverId } = req.params
    const decodedServerId = decodeURIComponent(serverId)
    
    // Get existing server to ensure we have required fields
    const existingServer = await registryService.getServerById(decodedServerId)
    if (!existingServer) {
      return res.status(404).json({
        success: false,
        error: `Server ${decodedServerId} not found`,
      })
    }
    
    // Validate request body (all fields optional for update)
    const updateData = publishServerSchema.partial().parse(req.body)
    
    // Ensure serverId matches
    if (updateData.serverId && updateData.serverId !== decodedServerId) {
      return res.status(400).json({
        success: false,
        error: 'serverId in body must match URL parameter',
      })
    }

    // Extract publishedBy from authenticated user or fallback
    let publishedBy: string
    if (req.user) {
      publishedBy = updateData.publishedBy || req.user.email || req.user.userId
    } else {
      const headerUserId = req.headers['x-user-id']
      const normalizedUserId = Array.isArray(headerUserId) ? headerUserId[0] : headerUserId
      publishedBy = updateData.publishedBy || normalizedUserId || 'anonymous'
    }

    const normalizedTools: MCPTool[] | undefined = updateData.tools?.map((tool) => ({
      ...tool,
      inputSchema: {
        ...tool.inputSchema,
        properties:
          (tool.inputSchema.properties as Record<string, MCPToolInputProperty>) || undefined,
      },
    }))

    // Merge update data with existing server data, ensuring required fields are present
    // For command/args: explicitly check if they're in updateData to allow clearing (null/undefined)
    // Use 'command' in updateData to detect if it was explicitly provided (even if null/undefined)
    const server = await registryService.publishServer({
      serverId: decodedServerId,
      name: updateData.name || existingServer.name, // Ensure name is always provided
      description: updateData.description ?? existingServer.description,
      version: updateData.version || existingServer.version,
      // Explicitly pass command/args if they're in the update data (even if null/undefined)
      // This allows clearing STDIO mode when converting to HTTP
      command: 'command' in updateData ? updateData.command : existingServer.command,
      args: 'args' in updateData ? updateData.args : existingServer.args,
      env: updateData.env ?? existingServer.env,
      tools: normalizedTools ?? existingServer.tools,
      capabilities: updateData.capabilities ?? existingServer.capabilities,
      manifest: updateData.manifest ?? existingServer.manifest,
      metadata: updateData.metadata ?? existingServer.metadata,
      publishedBy,
    })

    res.status(200).json({
      success: true,
      message: 'Server updated successfully',
      server,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      })
    }

    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message,
      })
    }

    next(error)
  }
})

/**
 * DELETE /v0.1/servers/:serverId
 * Delete an MCP server from the registry
 */
router.delete('/servers/:serverId', async (req, res, next) => {
  try {
    const { serverId } = req.params
    const decodedServerId = decodeURIComponent(serverId)

    // Check if server exists
    const server = await registryService.getServerById(decodedServerId)
    if (!server) {
      return res.status(404).json({
        success: false,
        error: 'Server not found',
        serverId: decodedServerId,
      })
    }

    // Delete server (soft delete by setting isActive to false, or hard delete)
    await registryService.deleteServer(decodedServerId)

    res.status(200).json({
      success: true,
      message: 'Server deleted successfully',
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /v0.1/servers/:serverId/install/:client
 * Generate install configuration for a specific client
 * 
 * Query parameters:
 * - client: One of 'claude-desktop', 'cursor', 'windsurf', 'cli'
 * 
 * Returns install configuration with instructions and file paths
 */
router.get('/servers/:serverId/install/:client', async (req, res, next) => {
  try {
    const { serverId, client } = req.params
    const decodedServerId = decodeURIComponent(serverId)
    const userAgent = req.headers['user-agent']

    // Validate client
    const validClients: InstallClient[] = ['claude-desktop', 'cursor', 'windsurf', 'cli']
    if (!validClients.includes(client as InstallClient)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid client',
        validClients,
      })
    }

    // Get server
    const server = await registryService.getServerById(decodedServerId)
    if (!server) {
      return res.status(404).json({
        success: false,
        error: 'Server not found',
        serverId: decodedServerId,
      })
    }

    // Generate install config
    const installConfig = installConfigService.generateInstallConfig(
      server,
      client as InstallClient,
      userAgent
    )

    res.json({
      success: true,
      ...installConfig,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /v0.1/servers/:serverId/permissions
 * Get server permissions and security analysis
 * 
 * Returns information about what the server can do, including:
 * - Capabilities
 * - Tool permissions
 * - Security warnings
 */
router.get('/servers/:serverId/permissions', async (req, res, next) => {
  try {
    const { serverId } = req.params
    const decodedServerId = decodeURIComponent(serverId)

    // Get server
    const server = await registryService.getServerById(decodedServerId)
    if (!server) {
      return res.status(404).json({
        success: false,
        error: 'Server not found',
        serverId: decodedServerId,
      })
    }

    // Analyze permissions
    const permissions = installConfigService.analyzePermissions(server)

    res.json({
      success: true,
      permissions,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /v0.1/servers/:serverId/discover-tools
 * Manually discover tools for a STDIO server
 */
router.post('/servers/:serverId/discover-tools', async (req, res, next) => {
  try {
    const { serverId } = req.params
    const decodedServerId = decodeURIComponent(serverId)

    console.log(`[Discover Tools] Requested for server: ${decodedServerId}`)
    const tools = await registryService.discoverToolsForServer(decodedServerId)

    res.json({
      success: true,
      message: `Discovered ${tools.length} tools`,
      tools,
    })
  } catch (error) {
    if (error instanceof Error) {
      return res.status(404).json({
        success: false,
        error: error.message,
      })
    }
    next(error)
  }
})

/**
 * POST /v0.1/invoke
 * Invoke an MCP tool on a registered server
 * 
 * Request body:
 * {
 *   "serverId": "com.langchain/agent-mcp-server",
 *   "tool": "agent_executor",
 *   "arguments": {
 *     "query": "user's query"
 *   }
 * }
 * 
 * Response:
 * {
 *   "result": {
 *     "content": [
 *       {
 *         "type": "text",
 *         "text": "response text"
 *       }
 *     ],
 *     "isError": false
 *   }
 * }
 */
const invokeToolSchema = z.object({
  serverId: z.string().min(1),
  tool: z.string().min(1),
  arguments: z.record(z.unknown()),
})

router.post('/invoke', async (req, res, next) => {
  try {
    const validated = invokeToolSchema.parse(req.body)

    const result = await mcpInvokeService.invokeTool({
      serverId: validated.serverId,
      tool: validated.tool,
      arguments: validated.arguments,
    })

    res.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      })
    }

    if (error instanceof Error) {
      // Check for quota/rate limit errors
      if (error.message.includes('quota') || error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('rate limit')) {
        return res.status(429).json({
          success: false,
          error: 'API Quota Exceeded',
          message: error.message,
          note: 'The Gemini API quota has been exceeded. The free tier has very limited quotas for image generation. Please check your quota, wait for the rate limit to reset, or upgrade to a paid plan.',
        })
      }
      
      return res.status(500).json({
        success: false,
        error: error.message,
      })
    }

    next(error)
  }
})

/**
 * GET /v0.1/debug/server/:serverId
 * Debug endpoint to check server metadata and HTTP headers
 * Useful for troubleshooting API key issues
 */
router.get(/^\/debug\/server\/(.+)$/, async (req, res, next) => {
  try {
    // Extract serverId from the regex match
    const serverId = req.params[0] || req.path.replace('/debug/server/', '')
    console.log('[Debug Route in Servers Router] Route matched! Path:', req.path, 'Extracted serverId:', serverId, 'Original URL:', req.originalUrl)
    console.log('[Debug] Fetching server:', serverId)
    const server = await registryService.getServerById(serverId)
    
    if (!server) {
      return res.status(404).json({
        success: false,
        error: `Server ${serverId} not found`,
      })
    }

    const metadata = server.metadata as Record<string, unknown> | undefined
    const httpHeaders = metadata?.httpHeaders as Record<string, unknown> | undefined

    res.json({
      success: true,
      server: {
        serverId: server.serverId,
        name: server.name,
        endpoint: metadata?.endpoint,
        hasMetadata: !!metadata,
        hasHttpHeaders: !!httpHeaders,
        httpHeaders: httpHeaders ? Object.keys(httpHeaders) : [],
        httpHeadersPreview: httpHeaders 
          ? Object.fromEntries(
              Object.entries(httpHeaders).map(([key, value]) => [
                key,
                typeof value === 'string' && key.toLowerCase().includes('key')
                  ? `${String(value).substring(0, 10)}...` 
                  : value
              ])
            )
          : null,
        metadataKeys: metadata ? Object.keys(metadata) : [],
      },
    })
  } catch (error) {
    console.error('[Debug] Error:', error)
    next(error)
  }
})

export default router
