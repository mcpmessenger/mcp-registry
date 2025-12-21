import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

/**
 * MCP STDIO Service
 * 
 * Handles communication with STDIO-based MCP servers (like @playwright/mcp)
 * These servers run via `npx` commands and communicate via JSON-RPC over stdin/stdout
 */
export class McpStdioService extends EventEmitter {
  private processes: Map<string, ChildProcess> = new Map()
  private messageId = 0
  private pendingRequests: Map<number, {
    resolve: (value: any) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }> = new Map()

  /**
   * Spawn an MCP server process and establish connection
   */
  async connect(serverId: string, command: string, args: string[], env?: Record<string, string>): Promise<void> {
    if (this.processes.has(serverId)) {
      // Already connected
      return
    }

    return new Promise((resolve, reject) => {
      const processEnv = {
        ...process.env,
        ...env,
      }

      // On Windows, we need to use shell mode for .cmd files to work properly
      // Also handle npx specifically on Windows
      let actualCommand = command
      let useShell = false
      
      if (process.platform === 'win32') {
        if (command === 'npx') {
          // On Windows, npx is actually npx.cmd, and we need shell mode
          actualCommand = 'npx.cmd'
          useShell = true
        } else if (command.endsWith('.cmd') || command.endsWith('.bat')) {
          useShell = true
        }
      }

      console.log(`🔄 Spawning MCP server ${serverId}: ${actualCommand} ${args.join(' ')}`)
      
      const proc = spawn(actualCommand, args, {
        env: processEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: useShell,
      })

      this.processes.set(serverId, proc)

      let buffer = ''
      let stderrBuffer = ''

      // Handle stdout (server responses)
      proc.stdout?.on('data', (data: Buffer) => {
        buffer += data.toString()
        
        // MCP uses JSON-RPC, messages are separated by newlines or content-length headers
        // Try to parse complete JSON messages
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line.trim())
              this.handleMessage(serverId, message)
            } catch (error) {
              // Not JSON, might be content-length header or other protocol message
              console.warn(`Failed to parse MCP message: ${line}`)
            }
          }
        }
      })

      // Handle stderr
      proc.stderr?.on('data', (data: Buffer) => {
        const stderrText = data.toString()
        stderrBuffer += stderrText
        console.log(`[${serverId}] stderr:`, stderrText)
      })

      // Handle process exit
      proc.on('exit', (code) => {
        console.log(`MCP Server ${serverId} exited with code ${code}`)
        this.processes.delete(serverId)
        this.emit('disconnect', serverId)
      })

      // Handle errors
      proc.on('error', (error) => {
        console.error(`Failed to spawn MCP server ${serverId}:`, error)
        this.processes.delete(serverId)
        reject(error)
      })

      // Initialize MCP connection
      // MCP servers typically expect an initialize request first
      // Give the process a moment to start up (especially for npx which may need to download packages)
      setTimeout(() => {
        // Use a longer timeout for initialization (90 seconds) since npx might need to download packages
        const initTimeout = setTimeout(() => {
          const errorMsg = `MCP server ${serverId} initialization timeout (90s). ` +
            `This may happen if:\n` +
            `1. The npm package is downloading (first time use of npx -y)\n` +
            `2. The package doesn't exist yet (e.g., @google/maps-mcp may not be published yet)\n` +
            `3. The server is slow to start\n\n` +
            `Command: ${actualCommand} ${args.join(' ')}\n` +
            `Stderr: ${stderrBuffer.substring(0, 500)}`
          reject(new Error(errorMsg))
        }, 90000) // 90 second timeout for initialization

        this.sendRequest(serverId, 'initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'mcp-registry',
            version: '1.0.0',
          },
        })
          .then(() => {
            clearTimeout(initTimeout)
            // Send initialized notification
            this.sendNotification(serverId, 'initialized', {})
            console.log(`✅ MCP server ${serverId} initialized successfully`)
            resolve()
          })
          .catch((error) => {
            clearTimeout(initTimeout)
            console.error(`❌ Failed to initialize MCP server ${serverId}:`, error)
            console.error(`Command: ${actualCommand} ${args.join(' ')}`)
            console.error(`Stderr: ${stderrBuffer.substring(0, 1000)}`)
            reject(error)
          })
      }, 2000) // Wait 2 seconds for process to start before sending initialize
    })
  }

  /**
   * Send a JSON-RPC request to the MCP server
   */
  async sendRequest(serverId: string, method: string, params?: any): Promise<any> {
    const proc = this.processes.get(serverId)
    if (!proc || proc.killed) {
      throw new Error(`MCP server ${serverId} is not connected`)
    }

    const id = ++this.messageId
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params: params || {},
    }

    return new Promise((resolve, reject) => {
      // Longer timeout for initialization (npx may need to download packages)
      // Browser operations (especially Playwright) can take longer in serverless environments
      const timeoutMs = method === 'initialize' ? 90000 : 120000 // 90s for init, 120s for browser operations
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request timeout for ${method} (${timeoutMs/1000}s)`))
      }, timeoutMs)

      this.pendingRequests.set(id, { resolve, reject, timeout })

      const message = JSON.stringify(request) + '\n'
      proc.stdin?.write(message, (error) => {
        if (error) {
          this.pendingRequests.delete(id)
          clearTimeout(timeout)
          reject(error)
        }
      })
    })
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  sendNotification(serverId: string, method: string, params?: any): void {
    const proc = this.processes.get(serverId)
    if (!proc || proc.killed) {
      console.warn(`Cannot send notification to ${serverId}: not connected`)
      return
    }

    const notification = {
      jsonrpc: '2.0',
      method,
      params: params || {},
    }

    const message = JSON.stringify(notification) + '\n'
    proc.stdin?.write(message)
  }

  /**
   * Handle incoming messages from MCP server
   */
  private handleMessage(serverId: string, message: any): void {
    // Handle response to request
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const { resolve, reject, timeout } = this.pendingRequests.get(message.id)!
      this.pendingRequests.delete(message.id)
      clearTimeout(timeout)

      if (message.error) {
        reject(new Error(message.error.message || 'MCP server error'))
      } else {
        resolve(message.result)
      }
      return
    }

    // Handle notifications from server
    if (message.method) {
      this.emit('notification', serverId, message.method, message.params)
    }
  }

  /**
   * Invoke a tool on an MCP server
   */
  async invokeTool(serverId: string, toolName: string, arguments_: Record<string, any>): Promise<any> {
    // Ensure connected
    if (!this.processes.has(serverId)) {
      throw new Error(`Server ${serverId} is not connected. Call connect() first.`)
    }

    // MCP tools are invoked via tools/call method
    const result = await this.sendRequest(serverId, 'tools/call', {
      name: toolName,
      arguments: arguments_,
    })

    return result
  }

  /**
   * Disconnect from an MCP server
   */
  disconnect(serverId: string): void {
    const proc = this.processes.get(serverId)
    if (proc && !proc.killed) {
      // Send shutdown notification if supported
      this.sendNotification(serverId, 'shutdown')
      
      // Give it a moment, then kill
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill()
        }
      }, 1000)
    }
    this.processes.delete(serverId)
  }

  /**
   * Check if a server is connected
   */
  isConnected(serverId: string): boolean {
    const proc = this.processes.get(serverId)
    return proc !== undefined && !proc.killed
  }

  /**
   * Cleanup all connections
   */
  cleanup(): void {
    for (const [serverId] of this.processes) {
      this.disconnect(serverId)
    }
  }
}

export const mcpStdioService = new McpStdioService()

// Cleanup on process exit
process.on('exit', () => {
  mcpStdioService.cleanup()
})

process.on('SIGINT', () => {
  mcpStdioService.cleanup()
  process.exit(0)
})

process.on('SIGTERM', () => {
  mcpStdioService.cleanup()
  process.exit(0)
})
