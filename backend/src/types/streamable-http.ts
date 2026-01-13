/**
 * Streamable HTTP Types
 * 
 * Type definitions for the MCP Streamable HTTP specification (Draft 2025-03-26).
 * This defines the session management, headers, and state for the unified /mcp endpoint.
 */

export interface McpSessionContext {
    /** Unique session identifier (UUID v4) */
    sessionId: string

    /** MCP protocol version (e.g., "2025-03-26") */
    protocolVersion: string

    /** Timestamp when session was created */
    createdAt: Date

    /** Timestamp of last activity on this session */
    lastActivityAt: Date

    /** Origin of the client (for security validation) */
    origin?: string

    /** Optional metadata about the client */
    metadata?: Record<string, any>
}

export interface McpStreamableHeaders {
    /** Session ID header (required for stateful operations) */
    'mcp-session-id'?: string

    /** Protocol version header */
    'mcp-protocol-version'?: string

    /** Accept header (must be 'text/event-stream' for stream upgrade) */
    'accept'?: string

    /** Last event ID for session resumption */
    'last-event-id'?: string

    /** Origin header for CORS and security validation */
    'origin'?: string
}

export interface McpStreamableRequest extends McpStreamableHeaders {
    /** Request body (for POST requests) */
    body?: any
}

/**
 * SSE (Server-Sent Events) message format
 */
export interface SseMessage {
    /** Event type (optional, defaults to 'message') */
    event?: string

    /** Event data (JSON stringified) */
    data: string

    /** Event ID (Pulsar Message ID for resumption) */
    id?: string

    /** Retry interval in milliseconds */
    retry?: number
}

/**
 * Session state stored in memory or Pulsar
 */
export interface SessionState {
    context: McpSessionContext

    /** Whether the session has an active SSE stream */
    hasActiveStream: boolean

    /** Pulsar consumer for this session (if streaming) */
    consumerId?: string

    /** Last Pulsar Message ID sent (for resumption) */
    lastMessageId?: string
}

/**
 * JSON-RPC request structure
 */
export interface JsonRpcRequest {
    jsonrpc: '2.0'
    method: string
    params?: any
    id?: string | number
}

/**
 * JSON-RPC response structure
 */
export interface JsonRpcResponse {
    jsonrpc: '2.0'
    result?: any
    error?: {
        code: number
        message: string
        data?: any
    }
    id?: string | number
}
