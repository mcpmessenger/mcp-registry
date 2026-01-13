/**
 * Unified MCP Endpoint Router
 * 
 * Implements the Streamable HTTP specification (Draft 2025-03-26).
 * Provides a single /mcp endpoint that handles both commands (POST) and streaming (GET).
 */

import express, { Request, Response } from 'express'
import { mcpSessionMiddleware, McpRequest, updateSession, getSession, deleteSession } from '../middleware/mcp-session.middleware'
import { JsonRpcRequest, JsonRpcResponse, SseMessage } from '../types/streamable-http'
import { env } from '../config/env'
import { createPulsarProducer, createPulsarConsumer, sendPulsarMessage, receivePulsarMessage, type PulsarConsumer } from '../services/orchestrator/pulsar'

const router = express.Router()

// Apply session middleware to all routes
router.use(mcpSessionMiddleware)

/**
 * POST /mcp - Command Ingress
 * 
 * Handles JSON-RPC commands from clients.
 * Returns immediate response or 202 Accepted for async operations.
 */
router.post('/', async (req: McpRequest, res: Response) => {
    try {
        const request = req.body as JsonRpcRequest

        if (!request || request.jsonrpc !== '2.0') {
            return res.status(400).json({
                jsonrpc: '2.0',
                error: {
                    code: -32600,
                    message: 'Invalid JSON-RPC request',
                },
                id: request?.id || null,
            })
        }

        console.log(`[MCP Endpoint] Command: ${request.method}, Session: ${req.mcpSession?.sessionId}`)

        // Handle different methods
        switch (request.method) {
            case 'initialize':
                // Return initialization response
                return res.json({
                    jsonrpc: '2.0',
                    result: {
                        protocolVersion: env.mcp.protocolVersion,
                        capabilities: {
                            streaming: true,
                            sessionResumption: true,
                        },
                        serverInfo: {
                            name: 'mcp-registry',
                            version: '1.0.0',
                        },
                    },
                    id: request.id,
                } as JsonRpcResponse)

            case 'tools/register':
                // Handle server registration
                return await handleServerRegistration(req, res, request)

            case 'tools/list':
                // Return available tools (placeholder)
                return res.json({
                    jsonrpc: '2.0',
                    result: {
                        tools: [],
                    },
                    id: request.id,
                } as JsonRpcResponse)

            default:
                return res.status(501).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32601,
                        message: `Method not implemented: ${request.method}`,
                    },
                    id: request.id,
                })
        }
    } catch (error) {
        console.error('[MCP Endpoint] Error handling POST:', error)
        return res.status(500).json({
            jsonrpc: '2.0',
            error: {
                code: -32603,
                message: error instanceof Error ? error.message : 'Internal server error',
            },
            id: null,
        })
    }
})

/**
 * GET /mcp - Stream Upgrade
 * 
 * Establishes a Server-Sent Events (SSE) stream for receiving async updates.
 * Supports session resumption via Last-Event-ID header.
 */
router.get('/', async (req: McpRequest, res: Response) => {
    const sessionId = req.mcpSession?.sessionId
    if (!sessionId) {
        return res.status(400).json({
            error: 'Session ID required',
        })
    }

    // Validate Accept header
    const accept = req.headers['accept']
    if (accept !== 'text/event-stream') {
        return res.status(406).json({
            error: 'This endpoint requires Accept: text/event-stream',
        })
    }

    console.log(`[MCP Stream] Opening SSE stream for session: ${sessionId}`)

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering

    // Flush headers to establish connection
    res.flushHeaders()

    // Mark session as having active stream
    updateSession(sessionId, { hasActiveStream: true })

    // Set up Pulsar consumer for session-specific messages
    const sessionTopic = `${env.pulsar.topics.sessions}/${sessionId}`
    let consumer: PulsarConsumer | null = null
    let keepAliveInterval: NodeJS.Timeout | null = null

    // Check if Pulsar is enabled
    if (!env.pulsar.enabled) {
        console.warn('[MCP Stream] Pulsar disabled - SSE streaming not available')
        res.status(503).json({
            error: 'SSE streaming requires Pulsar infrastructure (currently disabled)',
            hint: 'Set ENABLE_PULSAR=true and configure PULSAR_SERVICE_URL'
        })
        return
    }

    try {
        // Create Pulsar consumer
        consumer = await createPulsarConsumer(sessionTopic, `session-${sessionId}`)

        // Send initial connection message
        sendSseMessage(res, {
            event: 'connected',
            data: JSON.stringify({
                message: 'Stream connected',
                sessionId,
                timestamp: new Date().toISOString(),
            }),
        })

        // Set up keep-alive (every 15 seconds)
        keepAliveInterval = setInterval(() => {
            res.write(': keepalive\n\n')
        }, 15000)

        // Listen for messages from Pulsar
        const messageLoop = async () => {
            while (true) {
                try {
                    const msg = await receivePulsarMessage(consumer!, 5000)

                    if (msg) {
                        const messageId = `${msg.getMessageId().toString()}`
                        const data = msg.getData().toString('utf-8')

                        // Send as SSE
                        sendSseMessage(res, {
                            id: messageId,
                            data,
                        })

                        // Acknowledge message
                        await consumer!.acknowledge(msg)

                        // Update last message ID for resumption
                        updateSession(sessionId, { lastMessageId: messageId })
                    }
                } catch (error) {
                    if (error instanceof Error && error.message.includes('timeout')) {
                        // Timeout is expected, continue
                        continue
                    }
                    console.error('[MCP Stream] Error receiving message:', error)
                    break
                }
            }
        }

        // Start message loop
        messageLoop()

        // Handle client disconnect
        req.on('close', async () => {
            console.log(`[MCP Stream] Client disconnected: ${sessionId}`)

            // Clean up
            if (keepAliveInterval) {
                clearInterval(keepAliveInterval)
            }

            if (consumer) {
                await consumer.close()
            }

            // Update session state
            updateSession(sessionId, { hasActiveStream: false })
        })
    } catch (error) {
        console.error('[MCP Stream] Error setting up stream:', error)

        if (keepAliveInterval) {
            clearInterval(keepAliveInterval)
        }

        res.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream setup failed' })}\n\n`)
        res.end()
    }
})

/**
 * DELETE /mcp - Close Session
 * 
 * Explicitly closes a session and cleans up resources.
 */
router.delete('/', async (req: McpRequest, res: Response) => {
    const sessionId = req.mcpSession?.sessionId
    if (!sessionId) {
        return res.status(400).json({
            error: 'Session ID required',
        })
    }

    console.log(`[MCP Endpoint] Closing session: ${sessionId}`)

    // Delete session
    deleteSession(sessionId)

    return res.json({
        jsonrpc: '2.0',
        result: {
            message: 'Session closed',
        },
        id: null,
    })
})

/**
 * Handle server registration
 */
async function handleServerRegistration(
    req: McpRequest,
    res: Response,
    request: JsonRpcRequest
): Promise<Response> {
    try {
        const { serverInfo } = request.params || {}

        if (!serverInfo) {
            return res.status(400).json({
                jsonrpc: '2.0',
                error: {
                    code: -32602,
                    message: 'Missing serverInfo parameter',
                },
                id: request.id,
            })
        }

        // Validate server info (basic validation)
        if (!serverInfo.name || !serverInfo.version) {
            return res.status(400).json({
                jsonrpc: '2.0',
                error: {
                    code: -32602,
                    message: 'serverInfo must include name and version',
                },
                id: request.id,
            })
        }

        // Publish to Pulsar registrations topic (if enabled)
        if (env.pulsar.enabled) {
            try {
                const topic = env.pulsar.topics.registrations
                const producer = await createPulsarProducer(topic, 'mcp-core')

                await sendPulsarMessage(
                    producer,
                    {
                        type: 'registration',
                        serverInfo,
                        sessionId: req.mcpSession?.sessionId,
                        timestamp: new Date().toISOString(),
                    },
                    {}, // Empty properties
                    serverInfo.name // Use server name as key for compaction
                )

                console.log(`[MCP Endpoint] Server registered to Pulsar: ${serverInfo.name}`)
            } catch (error) {
                console.error('[MCP Endpoint] Failed to publish to Pulsar:', error)
                // Continue anyway - registration can work without Pulsar
            }
        } else {
            console.log(`[MCP Endpoint] Server registration logged (Pulsar disabled): ${serverInfo.name}`)
        }

        // Return 202 Accepted (async operation)
        return res.status(202).json({
            jsonrpc: '2.0',
            result: {
                status: 'accepted',
                message: 'Registration queued for processing',
            },
            id: request.id,
        } as JsonRpcResponse)
    } catch (error) {
        console.error('[MCP Endpoint] Registration error:', error)
        return res.status(500).json({
            jsonrpc: '2.0',
            error: {
                code: -32603,
                message: error instanceof Error ? error.message : 'Registration failed',
            },
            id: request.id,
        })
    }
}

/**
 * Send an SSE message
 */
function sendSseMessage(res: Response, message: SseMessage): void {
    if (message.event) {
        res.write(`event: ${message.event}\n`)
    }
    if (message.id) {
        res.write(`id: ${message.id}\n`)
    }
    if (message.retry) {
        res.write(`retry: ${message.retry}\n`)
    }
    res.write(`data: ${message.data}\n\n`)
}

export default router
