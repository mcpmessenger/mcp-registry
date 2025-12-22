/**
 * MCP HTTP Service
 * 
 * Handles communication with HTTP-based MCP servers
 * Manages MCP session initialization and tool invocations
 */

interface McpHttpSession {
  endpoint: string
  initialized: boolean
  initializedAt: number
}

export class McpHttpService {
  private sessions: Map<string, McpHttpSession> = new Map()
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes

  /**
   * Get or create a session for an HTTP MCP server
   */
  private getSession(endpoint: string): McpHttpSession {
    const sessionKey = endpoint
    let session = this.sessions.get(sessionKey)

    // Check if session expired
    if (session && Date.now() - session.initializedAt > this.SESSION_TIMEOUT) {
      this.sessions.delete(sessionKey)
      session = undefined
    }

    if (!session) {
      session = {
        endpoint,
        initialized: false,
        initializedAt: 0,
      }
      this.sessions.set(sessionKey, session)
    }

    return session
  }

  /**
   * Initialize MCP session with the server
   */
  async initializeSession(endpoint: string): Promise<void> {
    const session = this.getSession(endpoint)

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
        headers: {
          'Content-Type': 'application/json',
        },
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
   * Call a tool on an HTTP MCP server
   */
  async callTool(
    endpoint: string,
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<any> {
    // Ensure session is initialized
    await this.initializeSession(endpoint)

    // For browser_navigate, close any existing browser first to avoid "Browser is already in use" errors
    if (toolName === 'browser_navigate') {
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
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(closeRequest),
        })
        // Wait a moment for browser to close
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        // Ignore errors when closing (browser might not be open)
        console.warn('Failed to close browser before navigate:', error)
      }
    }

    const toolRequest = {
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
      headers: {
        'Content-Type': 'application/json',
      },
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
      throw new Error(errorMessage)
    }

    const result = await response.json()

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
