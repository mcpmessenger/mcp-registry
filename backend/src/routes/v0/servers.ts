import { Router } from 'express'
import { z } from 'zod'
import { registryService } from '../../services/registry.service'
import type { MCPServer, MCPTool, MCPToolInputProperty } from '../../types/mcp'

const router = Router()

/**
 * GET /v0/servers
 * Returns a JSON list of available design-capable MCP servers
 * This is the "App Store" entry point for the frontend
 * Complies with MCP v0.1 specification
 */
router.get('/servers', async (req, res, next) => {
  try {
    const servers = await registryService.getServers()
    res.json(servers)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /v0/servers/:serverId
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
 * POST /v0/publish
 * Publish/register a new MCP server to the registry
 * 
 * This endpoint strictly adheres to the MCP v0.1 specification and acts as
 * the canonical "App Store" publishing endpoint. It validates tool schemas
 * and ensures compatibility with major AI hosts like VS Code and Claude Desktop.
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

router.post('/publish', async (req, res, next) => {
  try {
    // Validate request body
    const validated = publishServerSchema.parse(req.body)

    // Extract publishedBy from auth context (if available)
    const headerUserId = req.headers['x-user-id']
    const normalizedUserId = Array.isArray(headerUserId) ? headerUserId[0] : headerUserId
    const publishedBy = validated.publishedBy || normalizedUserId || 'anonymous'

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

export default router
