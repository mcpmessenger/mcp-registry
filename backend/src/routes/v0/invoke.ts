import { Router } from 'express'
import { z } from 'zod'
import { registryService } from '../../services/registry.service'
import { mcpStdioService } from '../../services/mcp-stdio.service'
import { mcpHttpService } from '../../services/mcp-http.service'
import { memoryService } from '../../services/memory.service'
import { eventBusService } from '../../services/event-bus.service'
import type { MCPToolResult } from '../../types/mcp'
import type { MemoryType } from '../../services/memory.service'

const router = Router()

const invokeToolSchema = z.object({
  serverId: z.string().min(1),
  tool: z.string().min(1),
  arguments: z.record(z.any()),
})

/**
 * POST /v0.1/invoke
 * Invoke a tool on a registered MCP server
 * Supports both HTTP-based and STDIO-based (npx) MCP servers
 */
router.post('/invoke', async (req, res, next) => {
  try {
    const validated = invokeToolSchema.parse(req.body)

    // Handle special search_history tool
  if (validated.tool === 'search_history') {
    const { conversationId, query, options } = validated.arguments as {
      conversationId: string
      query: string
      options?: {
        limit?: number
        types?: string[]
        minImportance?: number
      }
    }

    const normalizeMemoryTypes = (types?: string[]): MemoryType[] | undefined => {
      if (!types || types.length === 0) {
        return undefined
      }

      const allowedTypes: MemoryType[] = ['preference', 'fact', 'context', 'instruction']
      const normalized = types
        .map((type) => type.trim().toLowerCase())
        .filter((type): type is MemoryType => allowedTypes.includes(type as MemoryType))

      return normalized.length > 0 ? normalized : undefined
    }

      if (!conversationId || !query) {
        return res.status(400).json({
          success: false,
          error: 'conversationId and query are required for search_history',
        })
      }

    const memories = await memoryService.searchHistory(
      conversationId,
      query,
      options
        ? {
            limit: options.limit,
            types: normalizeMemoryTypes(options.types),
            minImportance: options.minImportance,
          }
        : undefined
    )

      return res.json({
        success: true,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                memories,
                count: memories.length,
                query,
              }),
            },
          ],
        },
      })
    }

    // Get the server from registry
    const server = await registryService.getServerById(validated.serverId)
    if (!server) {
      return res.status(404).json({
        success: false,
        error: `Server ${validated.serverId} not found`,
      })
    }

    // Check if this is a STDIO-based server (has command/args)
    const isStdioServer = server.command && server.args && server.args.length > 0

    // For STDIO-based servers (like @playwright/mcp), use STDIO communication
    if (isStdioServer) {
      try {
        // Ensure connected
        if (!mcpStdioService.isConnected(validated.serverId)) {
          await mcpStdioService.connect(
            validated.serverId,
            server.command!,
            server.args!,
            server.env
          )
        }

        // Invoke tool via STDIO
        const result = await mcpStdioService.invokeTool(
          validated.serverId,
          validated.tool,
          validated.arguments
        )

        // Transform MCP result to our format
        const toolResult: MCPToolResult = {
          content: Array.isArray(result.content)
            ? result.content
            : typeof result.content === 'string'
            ? [{ type: 'text', text: result.content }]
            : [{ type: 'text', text: JSON.stringify(result) }],
          isError: result.isError || false,
        }

        // Emit standardized handover event for cross-server communication
        const { createHandoverEvent } = await import('../../types/handover-events')
        const { memoryService } = await import('../../services/memory.service')
        const conversationId = req.body.conversationId || req.body.contextId || ''
        const intent = req.body.intent || validated.arguments.query || validated.arguments.input || 'Tool invocation'
        
        // Generate memory snapshot URL if we have a conversationId
        let memorySnapshotUrl: string | undefined
        if (conversationId) {
          const baseUrl = `${req.protocol}://${req.get('host')}`
          memorySnapshotUrl = memoryService.generateSnapshotUrl(conversationId, baseUrl)
        }
        
        const handoverEvent = createHandoverEvent(
          `tool.${validated.tool}.completed`,
          validated.serverId,
          conversationId,
          intent,
          {
            lastToolOutput: {
              tool: validated.tool,
              serverId: validated.serverId,
              result: toolResult,
              timestamp: new Date().toISOString(),
            },
            memorySnapshotUrl,
            status: toolResult.isError ? 'failed' : 'success',
            correlationId: req.body.correlationId,
            metadata: {
              arguments: validated.arguments,
              transport: 'stdio',
            },
          }
        )
        
        await eventBusService.emitHandoverEvent(handoverEvent)

        return res.json({
          success: true,
          result: toolResult,
          transport: 'stdio',
        })
      } catch (stdioError) {
        console.error(`STDIO invocation error for ${validated.serverId}:`, stdioError)
        const errorMessage = stdioError instanceof Error ? stdioError.message : 'Unknown error'
        
        // Check if it's a package not found error
        const isPackageNotFound = errorMessage.includes('404') || 
                                  errorMessage.includes('Not found') ||
                                  errorMessage.includes('does not exist')
        
        return res.status(500).json({
          success: false,
          error: `Failed to invoke tool via STDIO: ${errorMessage}`,
          details: {
            serverId: validated.serverId,
            tool: validated.tool,
            transport: 'stdio',
            ...(isPackageNotFound && {
              suggestion: 'This MCP server package may not be published to npm yet. Google MCP servers are rolling out incrementally.'
            }),
          },
        })
      }
    }

    // For HTTP-based servers, use HTTP communication
    // Extract endpoint from metadata or manifest
    let endpoint: string | undefined
    if (server.metadata && typeof server.metadata === 'object') {
      const metadata = server.metadata as Record<string, unknown>
      endpoint = typeof metadata.endpoint === 'string' && metadata.endpoint.trim() !== '' 
        ? metadata.endpoint.trim() 
        : undefined
    }
    if (!endpoint && server.manifest && typeof server.manifest === 'object') {
      const manifest = server.manifest as Record<string, unknown>
      endpoint = typeof manifest.endpoint === 'string' && manifest.endpoint.trim() !== ''
        ? manifest.endpoint.trim()
        : undefined
    }

    if (!endpoint || endpoint === '') {
      console.error(`Server ${validated.serverId} missing endpoint. Metadata:`, server.metadata, 'Manifest:', server.manifest)
      return res.status(400).json({
        success: false,
        error: `Server ${validated.serverId} does not have an endpoint configured.`,
        details: {
          serverType: isStdioServer ? 'stdio' : 'http',
          hasCommand: !!server.command,
          hasArgs: !!server.args,
          hasMetadata: !!server.metadata,
          hasManifest: !!server.manifest,
          suggestion: isStdioServer 
            ? 'This server uses STDIO (npx command). Ensure the command is correct and dependencies are installed.'
            : 'Please edit the agent and add an endpoint URL (e.g., https://your-server.com)',
        },
      })
    }

    // Find the tool in the server's tools list
    const tool = server.tools.find((t) => t.name === validated.tool)
    if (!tool) {
      return res.status(404).json({
        success: false,
        error: `Tool ${validated.tool} not found on server ${validated.serverId}`,
      })
    }

    // HTTP-based server - use MCP HTTP service which handles initialization
    try {
      // Use the HTTP service which manages session initialization
      const result = await mcpHttpService.callTool(
        endpoint,
        validated.tool,
        validated.arguments
      )
      
      // Transform result to MCPToolResult format
      // Result from mcpHttpService.callTool is already the tool result
      let toolResult: MCPToolResult
      if (result && typeof result === 'object' && 'content' in result) {
        // Already in MCPToolResult format
        toolResult = {
          content: Array.isArray(result.content)
            ? result.content
            : typeof result.content === 'string'
            ? [{ type: 'text', text: result.content }]
            : [{ type: 'text', text: JSON.stringify(result.content) }],
          isError: result.isError || false,
        }
      } else {
        // Direct result (wrap it)
        toolResult = {
          content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result) }],
          isError: false,
        }
      }

      // Emit standardized handover event for cross-server communication
      const { createHandoverEvent } = await import('../../types/handover-events')
      const { memoryService } = await import('../../services/memory.service')
      const conversationId = req.body.conversationId || req.body.contextId || ''
      const intent = req.body.intent || validated.arguments.query || validated.arguments.input || 'Tool invocation'
      
      // Generate memory snapshot URL if we have a conversationId
      let memorySnapshotUrl: string | undefined
      if (conversationId) {
        const baseUrl = `${req.protocol}://${req.get('host')}`
        memorySnapshotUrl = memoryService.generateSnapshotUrl(conversationId, baseUrl)
      }
      
      const handoverEvent = createHandoverEvent(
        `tool.${validated.tool}.completed`,
        validated.serverId,
        conversationId,
        intent,
        {
          lastToolOutput: {
            tool: validated.tool,
            serverId: validated.serverId,
            result: toolResult,
            timestamp: new Date().toISOString(),
          },
          memorySnapshotUrl,
          status: toolResult.isError ? 'failed' : 'success',
          correlationId: req.body.correlationId,
          metadata: {
            arguments: validated.arguments,
            transport: 'http',
          },
        }
      )
      
      await eventBusService.emitHandoverEvent(handoverEvent)

      return res.json({
        success: true,
        result: toolResult,
        transport: 'http',
      })
    } catch (fetchError) {
      // Try alternative endpoint: /tools/call or /api/tools/call
      const alternativeEndpoints = [
        `${endpoint}/tools/call`,
        `${endpoint}/api/tools/call`,
        `${endpoint}/invoke`,
      ]

      for (const altEndpoint of alternativeEndpoints) {
        try {
          const response = await fetch(altEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tool: validated.tool,
              arguments: validated.arguments,
            }),
          })

          if (response.ok) {
            const result = await response.json()
            const toolResult: MCPToolResult = {
              content: Array.isArray(result.content)
                ? result.content
                : typeof result.content === 'string'
                ? [{ type: 'text', text: result.content }]
                : [{ type: 'text', text: JSON.stringify(result) }],
              isError: result.isError || false,
            }

            return res.json({
              success: true,
              result: toolResult,
              transport: 'http',
            })
          }
        } catch {
          // Continue to next endpoint
          continue
        }
      }

      // If all endpoints fail, return error
      return res.status(502).json({
        success: false,
        error: `Failed to invoke tool on server: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`,
        details: `Tried JSON-RPC on endpoint: ${endpoint}, and alternative endpoints: /mcp/invoke, /tools/call, /api/tools/call, /invoke`,
      })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      })
    }

    next(error)
  }
})

export default router
