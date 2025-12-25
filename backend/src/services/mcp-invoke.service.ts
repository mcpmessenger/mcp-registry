/**
 * Service for invoking MCP tools on registered servers
 * Handles both HTTP-based and STDIO-based MCP servers
 */

import { spawn, ChildProcess } from 'child_process'
import * as readline from 'readline'
import { registryService } from './registry.service'
import type { MCPServer } from '../types/mcp'

export interface InvokeToolRequest {
  serverId: string
  tool: string
  arguments: Record<string, unknown>
}

export interface InvokeToolResponse {
  result: {
    content: Array<{
      type: 'text' | 'image' | 'resource'
      text?: string
      data?: string
      mimeType?: string
    }>
    isError?: boolean
  }
}

export class MCPInvokeService {
  /**
   * Invoke a tool on an MCP server
   */
  async invokeTool(request: InvokeToolRequest): Promise<InvokeToolResponse> {
    // Get the server from registry
    const server = await registryService.getServerById(request.serverId)
    if (!server) {
      throw new Error(`Server ${request.serverId} not found`)
    }

    // Check if tool exists
    const tool = server.tools?.find(t => t.name === request.tool)
    if (!tool) {
      throw new Error(`Tool ${request.tool} not found on server ${request.serverId}`)
    }

    // Determine server type (HTTP or STDIO)
    const isHttpServer = !server.command && !server.args
    const endpoint = this.getServerEndpoint(server)

    if (isHttpServer && endpoint) {
      return this.invokeHttpTool(server, request.tool, request.arguments, endpoint)
    } else if (server.command) {
      return this.invokeStdioTool(server, request.tool, request.arguments)
    } else {
      throw new Error(`Server ${request.serverId} has no endpoint or command configured`)
    }
  }

  /**
   * Get the endpoint URL for an HTTP-based server
   */
  private getServerEndpoint(server: MCPServer): string | null {
    // Check metadata first
    if (server.metadata && typeof server.metadata === 'object') {
      const metadata = server.metadata as Record<string, unknown>
      if (typeof metadata.endpoint === 'string' && metadata.endpoint) {
        return metadata.endpoint
      }
    }

    // Check manifest
    if (server.manifest && typeof server.manifest === 'object') {
      const manifest = server.manifest as Record<string, unknown>
      if (typeof manifest.endpoint === 'string' && manifest.endpoint) {
        return manifest.endpoint
      }
    }

    return null
  }

  /**
   * Invoke a tool on an HTTP-based MCP server
   */
  private async invokeHttpTool(
    server: MCPServer,
    toolName: string,
    toolArgs: Record<string, unknown>,
    endpoint: string
  ): Promise<InvokeToolResponse> {
    try {
      // Determine the API format from metadata
      const metadata = server.metadata as Record<string, unknown> | undefined
      const apiFormat = metadata?.apiFormat as string | undefined

      let response: Response

      if (apiFormat === 'custom' || endpoint.includes('/mcp/invoke')) {
        // Custom API format (e.g., LangChain agent)
        // POST to /mcp/invoke with { tool, arguments }
        const invokeUrl = endpoint.endsWith('/mcp/invoke') 
          ? endpoint 
          : `${endpoint.replace(/\/$/, '')}/mcp/invoke`

        response = await fetch(invokeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tool: toolName,
            arguments: toolArgs,
          }),
        })
      } else {
        // Standard MCP JSON-RPC format
        // POST to endpoint with JSON-RPC request
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
              name: toolName,
              arguments: toolArgs,
            },
          }),
        })
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data = await response.json() as any

      // Handle different response formats
      let content: InvokeToolResponse['result']['content'] = []

      if (apiFormat === 'custom' || endpoint.includes('/mcp/invoke')) {
        // Custom format response
        if (typeof data === 'string') {
          content = [{ type: 'text', text: data }]
        } else if (data && typeof data === 'object' && data.result) {
          if (typeof data.result === 'string') {
            content = [{ type: 'text', text: data.result }]
          } else if (Array.isArray(data.result)) {
            content = data.result
          } else if (data.result && typeof data.result === 'object' && data.result.content) {
            content = Array.isArray(data.result.content) ? data.result.content : [{ type: 'text', text: String(data.result.content) }]
          } else {
            content = [{ type: 'text', text: JSON.stringify(data.result, null, 2) }]
          }
        } else if (data && typeof data === 'object' && data.content) {
          content = Array.isArray(data.content) ? data.content : [{ type: 'text', text: String(data.content) }]
        } else {
          content = [{ type: 'text', text: JSON.stringify(data, null, 2) }]
        }
      } else {
        // Standard JSON-RPC format
        if (data && typeof data === 'object' && data.result) {
          if (typeof data.result === 'string') {
            content = [{ type: 'text', text: data.result }]
          } else if (data.result && typeof data.result === 'object' && data.result.content) {
            content = Array.isArray(data.result.content) ? data.result.content : [{ type: 'text', text: String(data.result.content) }]
          } else {
            content = [{ type: 'text', text: JSON.stringify(data.result, null, 2) }]
          }
        } else if (data && typeof data === 'object' && data.error) {
          const error = data.error as { message?: string } | string
          const errorMessage = typeof error === 'string' ? error : error.message || JSON.stringify(error)
          throw new Error(`MCP error: ${errorMessage}`)
        } else {
          content = [{ type: 'text', text: JSON.stringify(data, null, 2) }]
        }
      }

      return {
        result: {
          content,
          isError: false,
        },
      }
    } catch (error) {
      console.error(`Error invoking tool ${toolName} on server ${server.serverId}:`, error)
      return {
        result: {
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : 'Unknown error occurred',
            },
          ],
          isError: true,
        },
      }
    }
  }

  /**
   * Invoke a tool on a STDIO-based MCP server
   */
  private async invokeStdioTool(
    server: MCPServer,
    toolName: string,
    toolArgs: Record<string, unknown>
  ): Promise<InvokeToolResponse> {
    return new Promise((resolve, reject) => {
      if (!server.command) {
        reject(new Error(`Server ${server.serverId} has no command configured`))
        return
      }

      const args = server.args || []
      const env = this.getServerEnv(server)
      
      console.log(`[STDIO] Spawning process: ${server.command} ${args.join(' ')}`)
      console.log(`[STDIO] Environment keys: ${Object.keys(env).join(', ')}`)
      
      // Spawn the MCP server process
      // Use shell: true for npx to work correctly
      const proc = spawn(server.command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true, // npx requires shell: true
        env: { ...process.env, ...env },
      })

      // State machine for MCP protocol
      type ConnectionState = 'INITIALIZING' | 'INITIALIZED' | 'CALLING' | 'COMPLETE'
      let state: ConnectionState = 'INITIALIZING'
      
      const initRequestId = 1
      const toolRequestId = 2
      const timeout = 120000 // 120 second timeout for image generation
      let timeoutId: NodeJS.Timeout

      // Use readline for line-buffered JSON-RPC message reading
      const rl = readline.createInterface({
        input: proc.stdout!,
        terminal: false,
      })

      // Handle each line (JSON-RPC message)
      rl.on('line', (line: string) => {
        if (!line.trim()) return
        
        try {
          const message = JSON.parse(line)
          console.log(`[STDIO] Received message (id=${message.id}, method=${message.method || 'response'}):`, JSON.stringify(message).substring(0, 200))
          
          // Handle initialize response
          if (message.id === initRequestId && state === 'INITIALIZING') {
            if (message.error) {
              clearTimeout(timeoutId)
              proc.kill()
              rl.close()
              reject(new Error(`MCP initialize error: ${message.error.message || JSON.stringify(message.error)}`))
              return
            }
            
            if (message.result) {
              state = 'INITIALIZED'
              console.log(`[STDIO] Initialize successful for ${server.serverId}`)
              
              // CRITICAL: Send initialized notification AFTER receiving initialize response
              const initializedNotification = {
                jsonrpc: '2.0',
                method: 'notifications/initialized',
              }
              proc.stdin?.write(JSON.stringify(initializedNotification) + '\n')
              console.log(`[STDIO] Sent initialized notification`)
              
              // Now send the tool call
              state = 'CALLING'
              const toolRequest = {
                jsonrpc: '2.0',
                id: toolRequestId,
                method: 'tools/call',
                params: {
                  name: toolName,
                  arguments: toolArgs,
                },
              }
              
              proc.stdin?.write(JSON.stringify(toolRequest) + '\n')
              console.log(`[STDIO] Sent tool call: ${toolName} to ${server.serverId}`)
              
              // Set timeout for tool call
              clearTimeout(timeoutId)
              timeoutId = setTimeout(() => {
                proc.kill()
                rl.close()
                reject(new Error(`Tool call timeout after ${timeout / 1000} seconds`))
              }, timeout)
            }
          }
          // Handle tool call response
          else if (message.id === toolRequestId && state === 'CALLING') {
            state = 'COMPLETE'
            clearTimeout(timeoutId)
            proc.kill()
            rl.close()
            
            if (message.error) {
              reject(new Error(`MCP tool error: ${message.error.message || JSON.stringify(message.error)}`))
            } else if (message.result) {
              // Convert MCP result to our format
              let content: InvokeToolResponse['result']['content'] = []
              
              if (message.result.content) {
                content = Array.isArray(message.result.content) 
                  ? message.result.content 
                  : [{ type: 'text', text: String(message.result.content) }]
              } else if (typeof message.result === 'string') {
                content = [{ type: 'text', text: message.result }]
              } else {
                content = [{ type: 'text', text: JSON.stringify(message.result, null, 2) }]
              }
              
              console.log(`[STDIO] Tool call completed for ${server.serverId}, result type: ${content[0]?.type || 'unknown'}`)
              resolve({
                result: {
                  content,
                  isError: false,
                },
              })
            } else {
              reject(new Error('Invalid MCP response format'))
            }
          }
        } catch (e) {
          console.error(`[STDIO] Failed to parse MCP line: ${line.substring(0, 100)}`, e)
          // Continue processing - might be partial JSON
        }
      })

      // Handle stderr - log ALL errors (this is where API errors show up)
      let stderrBuffer = ''
      proc.stderr?.on('data', (data: Buffer) => {
        stderrBuffer += data.toString()
        const lines = stderrBuffer.split('\n')
        stderrBuffer = lines.pop() || '' // Keep incomplete line
        
        for (const line of lines) {
          if (line.trim()) {
            // Log all stderr except npm download noise
            if (!line.includes('Downloading') && !line.includes('Installing') && !line.includes('npm')) {
              console.error(`[STDIO ${server.serverId} stderr]:`, line.trim())
            }
          }
        }
      })

      // Handle process errors
      proc.on('error', (error) => {
        clearTimeout(timeoutId)
        rl.close()
        reject(new Error(`Failed to spawn process: ${error.message}`))
      })

      proc.on('exit', (code, signal) => {
        clearTimeout(timeoutId)
        rl.close()
        if (state !== 'COMPLETE') {
          if (code !== 0 && code !== null) {
            console.warn(`[STDIO] Process exited with code ${code} (signal: ${signal}) before completion`)
            if (state === 'INITIALIZING') {
              reject(new Error(`Process exited during initialization with code ${code}`))
            } else if (state === 'CALLING') {
              reject(new Error(`Process exited during tool call with code ${code}`))
            }
          }
        }
      })

      // Send initialize request first
      const initRequest = {
        jsonrpc: '2.0',
        id: initRequestId,
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

      proc.stdin?.write(JSON.stringify(initRequest) + '\n')
      console.log(`[STDIO] Sent initialize request to ${server.serverId}`)
      
      // Set timeout for initialization (should happen quickly)
      timeoutId = setTimeout(() => {
        if (state === 'INITIALIZING') {
          proc.kill()
          rl.close()
          reject(new Error(`Initialize timeout after 10 seconds`))
        }
      }, 10000)
    })
  }


  /**
   * Get environment variables for the server
   */
  private getServerEnv(server: MCPServer): Record<string, string> {
    const env: Record<string, string> = {}
    
    if (server.env && typeof server.env === 'object') {
      Object.assign(env, server.env)
    }
    
    // Check metadata for API keys (legacy support)
    if (server.metadata && typeof server.metadata === 'object') {
      const metadata = server.metadata as Record<string, unknown>
      // If metadata has authConfig, extract API keys
      if (metadata.authConfig && typeof metadata.authConfig === 'object') {
        const authConfig = metadata.authConfig as Record<string, unknown>
        if (authConfig.apiKey) {
          env.GEMINI_API_KEY = String(authConfig.apiKey)
        }
        if (authConfig.geminiApiKey) {
          env.GEMINI_API_KEY = String(authConfig.geminiApiKey)
        }
      }
    }
    
    return env
  }
}

export const mcpInvokeService = new MCPInvokeService()

