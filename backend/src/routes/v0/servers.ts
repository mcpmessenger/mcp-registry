import { Router } from 'express'
import { z } from 'zod'
import { registryService } from '../../services/registry.service'
import { authenticateUser } from '../../middleware/auth.middleware'
import { installConfigService, type InstallClient } from '../../services/install-config.service'
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
 */
router.get('/servers', async (req, res, next) => {
  try {
    const { search, capability } = req.query
    const servers = await registryService.getServers({
      search: typeof search === 'string' ? search : undefined,
      capability: typeof capability === 'string' ? capability : undefined,
    })
    res.json(servers)
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
    // Validate request body
    const validated = publishServerSchema.parse(req.body)

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

    const server = await registryService.publishServer({
      ...validated,
      tools: normalizedTools,
      publishedBy,
    })

    res.status(200).json({
      success: true,
      message: 'Server published successfully',
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

    // Check for duplicate serverId
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return res.status(409).json({
        success: false,
        error: 'Server with this serverId already exists',
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
    const server = await registryService.publishServer({
      serverId: decodedServerId,
      name: updateData.name || existingServer.name, // Ensure name is always provided
      description: updateData.description ?? existingServer.description,
      version: updateData.version || existingServer.version,
      command: updateData.command ?? existingServer.command,
      args: updateData.args ?? existingServer.args,
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

export default router
