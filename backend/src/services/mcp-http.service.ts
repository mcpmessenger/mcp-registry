/**
 * MCP HTTP Service
 * 
 * Handles communication with HTTP-based MCP servers
 * Manages MCP session initialization and tool invocations
 */

interface McpHttpSession {
  endpoint: string
  headersKey: string
  initialized: boolean
  initializedAt: number
}

type HttpHeaders = Record<string, string>

function normalizeHeaders(headers?: Record<string, unknown> | null): HttpHeaders {
  if (!headers || typeof headers !== 'object') return {}
  const result: HttpHeaders = {}
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = String(value)
    }
  }
  return result
}

function sessionKey(endpoint: string, headers: HttpHeaders): string {
  return `${endpoint}::${JSON.stringify(headers)}`
}

function mergeHeaders(base: HttpHeaders, extra: HttpHeaders): HttpHeaders {
  return { ...base, ...extra }
}

export class McpHttpService {
  private sessions: Map<string, McpHttpSession> = new Map()
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes

  /**
   * Get or create a session for an HTTP MCP server
   */
  private getSession(endpoint: string, headers: HttpHeaders): McpHttpSession {
    const key = sessionKey(endpoint, headers)
    let session = this.sessions.get(key)

    // Check if session expired
    if (session && Date.now() - session.initializedAt > this.SESSION_TIMEOUT) {
      this.sessions.delete(key)
      session = undefined
    }

    if (!session) {
      session = {
        endpoint,
        headersKey: key,
        initialized: false,
        initializedAt: 0,
      }
      this.sessions.set(key, session)
    }

    return session
  }

  /**
   * Initialize MCP session with the server
   */
  async initializeSession(endpoint: string, headers?: Record<string, unknown> | null): Promise<void> {
    const normalizedHeaders = normalizeHeaders(headers)
    const session = this.getSession(endpoint, normalizedHeaders)

    if (session.initialized) {
      return // Already initialized
    }

    const initRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
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

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: mergeHeaders(
          {
            'Content-Type': 'application/json',
          },
          normalizedHeaders
        ),
        body: JSON.stringify(initRequest),
      })

      if (!response.ok) {
        // Some servers don't require initialization, that's okay
        if (response.status === 401) {
          throw new Error(`MCP server requires initialization but returned 401: ${response.statusText}`)
        }
        // For other errors, log but don't fail - server might not require init
        console.warn(`MCP initialize returned ${response.status}, continuing anyway`)
        session.initialized = true
        session.initializedAt = Date.now()
        return
      }

      const result = await response.json()
      
      // Check for JSON-RPC error
      if (result.error) {
        throw new Error(`MCP initialize error: ${result.error.message || JSON.stringify(result.error)}`)
      }

      // Mark as initialized
      session.initialized = true
      session.initializedAt = Date.now()
      console.log(`✅ MCP session initialized for ${endpoint}`)
    } catch (error) {
      // If initialization fails with 401, it's likely required
      if (error instanceof Error && error.message.includes('401')) {
        throw error
      }
      // For other errors, log but mark as initialized anyway
      // Some servers might not require explicit initialization
      console.warn(`MCP initialize failed for ${endpoint}, continuing anyway:`, error)
      session.initialized = true
      session.initializedAt = Date.now()
    }
  }

  /**
   * Check if endpoint uses custom API format (not standard MCP JSON-RPC)
   */
  private isCustomApiFormat(endpoint: string): boolean {
    // LangChain server uses /mcp/invoke with custom format
    return endpoint.includes('/mcp/invoke')
  }

  /**
   * Call a tool on an HTTP MCP server
   */
  async callTool(
    endpoint: string,
    toolName: string,
    arguments_: Record<string, unknown>,
    headers?: Record<string, unknown> | null
  ): Promise<any> {
    // Check if this is a custom API format (not standard JSON-RPC)
    const isCustomFormat = this.isCustomApiFormat(endpoint)
    const normalizedHeaders = normalizeHeaders(headers)
    
    // Only initialize session for standard MCP JSON-RPC servers
    if (!isCustomFormat) {
      await this.initializeSession(endpoint, normalizedHeaders)
    }

    // For browser_navigate, close any existing browser first to avoid "Browser is already in use" errors
    if (toolName === 'browser_navigate' && !isCustomFormat) {
      try {
        const closeRequest = {
          jsonrpc: '2.0',
          id: Date.now() - 1, // Use different ID
          method: 'tools/call',
          params: {
            name: 'browser_close',
            arguments: {},
          },
        }
        const closeResponse = await fetch(endpoint, {
          method: 'POST',
          headers: mergeHeaders(
            {
              'Content-Type': 'application/json',
            },
            normalizedHeaders
          ),
          body: JSON.stringify(closeRequest),
          signal: AbortSignal.timeout(5000), // 5 second timeout for close
        })
        
        // Wait a moment for browser to fully close
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Log if close was successful (but don't fail if it wasn't)
        if (closeResponse.ok) {
          const closeResult = await closeResponse.json()
          if (closeResult.error) {
            console.log('Browser close returned error (may not have been open):', closeResult.error.message)
          } else {
            console.log('Browser closed successfully before navigate')
          }
        }
      } catch (error) {
        // Ignore errors when closing (browser might not be open, or close timed out)
        console.log('Browser close attempt completed (may not have been needed):', error instanceof Error ? error.message : String(error))
      }
    }

    // Use custom format for LangChain server, standard JSON-RPC for others
    const toolRequest = isCustomFormat
      ? {
          tool: toolName,
          arguments: arguments_,
        }
      : {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: arguments_,
          },
        }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: mergeHeaders(
        {
          'Content-Type': 'application/json',
        },
        normalizedHeaders
      ),
      body: JSON.stringify(toolRequest),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message
        }
      } catch {
        // Not JSON, use text
        if (errorText) {
          errorMessage = `${errorMessage}: ${errorText}`
        }
      }
      console.error('MCP HTTP call failed', {
        endpoint,
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      })
      throw new Error(errorMessage)
    }

    const result = await response.json()

    // Handle custom API format (LangChain server)
    if (isCustomFormat) {
      // Custom format returns { content: [...], isError: false } directly
      return result
    }

    // Handle JSON-RPC error response
    if (result.error) {
      throw new Error(result.error.message || JSON.stringify(result.error))
    }

    return result.result || result
  }

  /**
   * Clear a session (useful for testing or reconnection)
   */
  clearSession(endpoint: string): void {
    this.sessions.delete(endpoint)
  }

  /**
   * Clear all sessions
   */
  clearAllSessions(): void {
    this.sessions.clear()
  }
}

export const mcpHttpService = new McpHttpService()
