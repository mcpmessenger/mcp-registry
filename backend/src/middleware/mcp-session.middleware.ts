/**
 * MCP Session Management Middleware
 * 
 * Implements session validation, generation, and security for the Streamable HTTP endpoint.
 * Based on the MCP Streamable HTTP specification (Draft 2025-03-26).
 */

import { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import { env } from '../config/env'
import { McpSessionContext, SessionState } from '../types/streamable-http'

// In-memory session store (for development - use Pulsar/Redis in production)
const sessionStore = new Map<string, SessionState>()

/**
 * Extended Express Request with MCP session context
 */
export interface McpRequest extends Request {
    mcpSession?: McpSessionContext
}

/**
 * Session validation and management middleware
 */
export function mcpSessionMiddleware(
    req: McpRequest,
    res: Response,
    next: NextFunction
): void {
    // Extract headers
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    const protocolVersion = (req.headers['mcp-protocol-version'] as string) || env.mcp.protocolVersion
    const origin = req.headers['origin'] as string | undefined

    // Validate protocol version
    if (protocolVersion !== env.mcp.protocolVersion) {
        res.status(400).json({
            jsonrpc: '2.0',
            error: {
                code: -32600,
                message: `Unsupported protocol version: ${protocolVersion}. Server supports: ${env.mcp.protocolVersion}`,
            },
            id: null,
        })
        return
    }

    // Validate origin (security: prevent DNS rebinding)
    if (origin && !isOriginAllowed(origin)) {
        console.warn(`[MCP Session] Rejected request from unauthorized origin: ${origin}`)
        res.status(403).json({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Origin not allowed',
            },
            id: null,
        })
        return
    }

    // Check if this is an initialize request
    const isInitialize = req.body?.method === 'initialize'

    if (isInitialize) {
        // Generate new session ID
        const newSessionId = randomUUID()
        const sessionContext: McpSessionContext = {
            sessionId: newSessionId,
            protocolVersion,
            createdAt: new Date(),
            lastActivityAt: new Date(),
            origin,
        }

        // Store session
        sessionStore.set(newSessionId, {
            context: sessionContext,
            hasActiveStream: false,
        })

        // Attach session to request
        req.mcpSession = sessionContext

        // Add session ID to response header
        res.setHeader('Mcp-Session-Id', newSessionId)
        res.setHeader('Mcp-Protocol-Version', protocolVersion)

        console.log(`[MCP Session] New session created: ${newSessionId}`)
        next()
    } else {
        // Require session ID for non-initialize requests
        if (!sessionId) {
            res.status(400).json({
                jsonrpc: '2.0',
                error: {
                    code: -32600,
                    message: 'Missing Mcp-Session-Id header. Call initialize first.',
                },
                id: null,
            })
            return
        }

        // Validate session exists
        const sessionState = sessionStore.get(sessionId)
        if (!sessionState) {
            res.status(404).json({
                jsonrpc: '2.0',
                error: {
                    code: -32001,
                    message: 'Session not found. It may have expired or the server restarted.',
                },
                id: null,
            })
            return
        }

        // Update last activity
        sessionState.context.lastActivityAt = new Date()

        // Attach session to request
        req.mcpSession = sessionState.context

        // Echo session headers
        res.setHeader('Mcp-Session-Id', sessionId)
        res.setHeader('Mcp-Protocol-Version', protocolVersion)

        next()
    }
}

/**
 * Check if origin is allowed based on configuration
 */
function isOriginAllowed(origin: string): boolean {
    const allowedOrigins = env.mcp.allowedOrigins

    // Development mode: allow localhost and local IPs
    if (env.server.nodeEnv === 'development') {
        if (
            origin.includes('localhost') ||
            origin.includes('127.0.0.1') ||
            /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(origin) || // IPv4
            /^https?:\/\/\[?([0-9a-fA-F:]+)\]?(:\d+)?$/.test(origin) // IPv6
        ) {
            return true
        }
    }

    // Check against allowlist
    return allowedOrigins.some((allowed) => {
        if (allowed === '*') return true
        return origin === allowed || origin.startsWith(allowed)
    })
}

/**
 * Get session state by session ID
 */
export function getSession(sessionId: string): SessionState | undefined {
    return sessionStore.get(sessionId)
}

/**
 * Update session state
 */
export function updateSession(sessionId: string, updates: Partial<SessionState>): void {
    const session = sessionStore.get(sessionId)
    if (session) {
        sessionStore.set(sessionId, { ...session, ...updates })
    }
}

/**
 * Delete session
 */
export function deleteSession(sessionId: string): void {
    sessionStore.delete(sessionId)
    console.log(`[MCP Session] Session deleted: ${sessionId}`)
}

/**
 * Clean up expired sessions (run periodically)
 */
export function cleanupExpiredSessions(): void {
    const now = Date.now()
    const ttlMs = env.mcp.sessionTtl * 1000

    let cleaned = 0
    for (const [sessionId, state] of sessionStore.entries()) {
        const age = now - state.context.lastActivityAt.getTime()
        if (age > ttlMs) {
            sessionStore.delete(sessionId)
            cleaned++
        }
    }

    if (cleaned > 0) {
        console.log(`[MCP Session] Cleaned up ${cleaned} expired sessions`)
    }
}

// Start cleanup interval (every 5 minutes)
setInterval(cleanupExpiredSessions, 5 * 60 * 1000)
