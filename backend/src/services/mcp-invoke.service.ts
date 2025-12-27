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
      url?: string
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
      // SPECIAL CASE: If this is a Playwright browser_navigate with search_query,
      // route to LangChain server's auto-search endpoint
      if (
        toolName === 'browser_navigate' &&
        (toolArgs.search_query || toolArgs.searchQuery) &&
        server.serverId.includes('playwright')
      ) {
        const langchainEndpoint = process.env.LANGCHAIN_ENDPOINT || 'https://langchain-agent-mcp-server-554655392699.us-central1.run.app'
        const autoSearchUrl = `${langchainEndpoint}/api/playwright/navigate`
        
        console.log(`[HTTP] Routing Playwright browser_navigate with search_query to LangChain auto-search endpoint: ${autoSearchUrl}`)
        
        // Map parameters to match the LangChain endpoint format
        const searchQuery = toolArgs.search_query || toolArgs.searchQuery
        const requestBody: Record<string, unknown> = {
          url: toolArgs.url,
          search_query: searchQuery,
          auto_search: toolArgs.auto_search !== false, // Default to true
        }
        
        // Include optional parameters if present
        if (toolArgs.wait_timeout) requestBody.wait_timeout = toolArgs.wait_timeout
        if (toolArgs.search_box_selector) requestBody.search_box_selector = toolArgs.search_box_selector
        if (toolArgs.search_button_selector) requestBody.search_button_selector = toolArgs.search_button_selector
        if (toolArgs.wait_for_results !== undefined) requestBody.wait_for_results = toolArgs.wait_for_results
        
        const response = await fetch(autoSearchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }
        
        const data = await response.json() as any
        
        // Convert LangChain response format to MCP format
        let content: InvokeToolResponse['result']['content'] = []
        
        if (data.snapshot) {
          // Response has a snapshot field
          content = [{
            type: 'text',
            text: `Successfully navigated to ${data.url}${data.search_performed ? ` and performed search for '${data.search_query}'` : ''}.\n\nPage Snapshot:\n\`\`\`yaml\n${data.snapshot}\n\`\`\``
          }]
          
          // Add warnings/errors if present
          if (data.warnings && data.warnings.length > 0) {
            content[0].text += `\n\n⚠️ Warnings: ${data.warnings.join(', ')}`
          }
          if (data.errors && data.errors.length > 0) {
            content[0].text += `\n\n❌ Errors: ${data.errors.join(', ')}`
          }
        } else {
          content = [{ type: 'text', text: JSON.stringify(data, null, 2) }]
        }
        
        return {
          result: {
            content,
            isError: false,
          },
        }
      }

      // Determine the API format from metadata
      const metadata = server.metadata as Record<string, unknown> | undefined
      const apiFormat = metadata?.apiFormat as string | undefined

      // Extract HTTP headers from metadata (for API keys, auth, etc.)
      const httpHeaders: Record<string, string> = {}
      if (metadata?.httpHeaders && typeof metadata.httpHeaders === 'object') {
        const headers = metadata.httpHeaders as Record<string, unknown>
        for (const [key, value] of Object.entries(headers)) {
          if (typeof value === 'string') {
            httpHeaders[key] = value
          }
        }
      }

      // Build request headers - use a Headers object so we can send multiple
      // `Accept` header entries (some servers require separate Accept headers)
      const buildHeaders = (metadataHeaders: Record<string, string>) => {
        const headers = new Headers()

        // defaults
        headers.set('Content-Type', 'application/json')
        // For JSON-RPC servers (like Exa), try single comma-separated header first
        // For custom API format servers, use separate headers
        if (apiFormat === 'jsonrpc' || (!apiFormat && !endpoint.includes('/mcp/invoke'))) {
          // JSON-RPC format: use single comma-separated Accept header
          headers.set('Accept', 'application/json, text/event-stream')
        } else {
          // Custom format: append as separate headers
          'application/json, text/event-stream'
            .split(',')
            .map(s => s.trim())
            .forEach(v => headers.append('Accept', v))
        }

        // apply metadata headers (override or add)
        for (const [k, v] of Object.entries(metadataHeaders)) {
          if (!v) continue
          if (k.toLowerCase() === 'accept') {
            // replace existing Accept values with the metadata-provided ones (split by comma)
            headers.delete('Accept')
            v.split(',').map(s => s.trim()).forEach(val => headers.append('Accept', val))
          } else {
            headers.set(k, v)
          }
        }

        return headers
      }

      const baseHeaders = buildHeaders(httpHeaders)

      let response: Response

      if (apiFormat === 'custom' || endpoint.includes('/mcp/invoke')) {
        // Custom API format (e.g., LangChain agent)
        // POST to /mcp/invoke with { tool, arguments }
        const invokeUrl = endpoint.endsWith('/mcp/invoke') 
          ? endpoint 
          : `${endpoint.replace(/\/$/, '')}/mcp/invoke`

        console.log(`[HTTP] Invoking ${toolName} on ${server.serverId} at ${invokeUrl}`)
        console.log(`[HTTP] Headers:`, Array.from(baseHeaders.keys()).join(', '))
        console.log(`[HTTP] Request headers full:`, JSON.stringify(Object.fromEntries(baseHeaders.entries())))
        if (httpHeaders['X-Goog-Api-Key']) {
          console.log(`[HTTP] Google Maps API key present: ${httpHeaders['X-Goog-Api-Key'].substring(0, 10)}...`)
        }

        response = await fetch(invokeUrl, {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({
            tool: toolName,
            arguments: toolArgs,
          }),
        })
      } else {
        // Standard MCP JSON-RPC format (e.g., Google Maps Grounding Lite)
        // POST to endpoint with JSON-RPC request
        console.log(`[HTTP] Invoking ${toolName} on ${server.serverId} at ${endpoint}`)
        console.log(`[HTTP] Headers:`, Array.from(baseHeaders.keys()).join(', '))
        console.log(`[HTTP] Request headers full:`, JSON.stringify(Object.fromEntries(baseHeaders.entries())))
        if (httpHeaders['X-Goog-Api-Key']) {
          console.log(`[HTTP] Google Maps API key present: ${httpHeaders['X-Goog-Api-Key'].substring(0, 10)}...`)
        }

        response = await fetch(endpoint, {
          method: 'POST',
          headers: baseHeaders,
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

        // If the server complains about Accept negotiation, retry with several Accept header permutations
          if (response.status === 406 && typeof errorText === 'string' && errorText.toLowerCase().includes('not acceptable')) {
          console.log(`[HTTP] Received 406 Not Acceptable - attempting Accept header fallbacks`)

          const attempts = [
            // Try as single comma-separated header (some servers require this format)
            { Accept: 'application/json, text/event-stream', useSingleHeader: true },
            { Accept: 'text/event-stream, application/json', useSingleHeader: true },
            // Try as separate headers (current approach)
            { Accept: 'application/json, text/event-stream', useSingleHeader: false },
            { Accept: 'text/event-stream, application/json', useSingleHeader: false },
            // Try just one
            { Accept: 'text/event-stream', useSingleHeader: true },
            { Accept: 'application/json', useSingleHeader: true },
          ]

          let success = false
          let lastErr: string | null = null

          for (const attempt of attempts) {
            // clone baseHeaders
            const retryHeaders = new Headers(baseHeaders)
            // apply Accept override from attempt
            if (attempt.Accept) {
              retryHeaders.delete('Accept')
              if (attempt.useSingleHeader) {
                // Set as single comma-separated value
                retryHeaders.set('Accept', attempt.Accept)
              } else {
                // Append as separate headers
                attempt.Accept.split(',').map(s => s.trim()).forEach(v => retryHeaders.append('Accept', v))
              }
            }
            retryHeaders.set('Connection', 'keep-alive')
            try {
              const body = (response.url && response.url.includes('/mcp/invoke'))
                ? JSON.stringify({ tool: toolName, arguments: toolArgs })
                : JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: toolName, arguments: toolArgs } })

              const retryResponse = await fetch(response.url || endpoint, {
                method: 'POST',
                headers: retryHeaders,
                body,
              })

              if (retryResponse.ok) {
                response = retryResponse
                success = true
                console.log(`[HTTP] Retry succeeded with Accept=${attempt.Accept} (singleHeader=${attempt.useSingleHeader})`)
                break
              } else {
                const retryText = await retryResponse.text()
                lastErr = `HTTP ${retryResponse.status}: ${retryText}`
                console.log(`[HTTP] Retry failed with Accept=${attempt.Accept} (singleHeader=${attempt.useSingleHeader}): ${lastErr}`)
              }
            } catch (e) {
              lastErr = String(e)
              console.log(`[HTTP] Retry fetch failed with Accept=${attempt.Accept} (singleHeader=${attempt.useSingleHeader}): ${lastErr}`)
            }
          }

          if (!success) {
            throw new Error(`HTTP ${response.status}: ${errorText} (retries failed: ${lastErr}) -- requestHeaders: ${JSON.stringify(Object.fromEntries(baseHeaders.entries()))}`)
          }
        } else {
          // Include the request headers in the thrown error for debugging
          throw new Error(`HTTP ${response.status}: ${errorText} -- requestHeaders: ${JSON.stringify(Object.fromEntries(baseHeaders.entries()))}`)
        }
      }

      // Check if response is Server-Sent Events (SSE) format
      const contentType = response.headers.get('content-type') || ''
      const isSSE = contentType.includes('text/event-stream') || contentType.includes('text/event')
      
      // Read response as text first (can be reused for both JSON and SSE)
      const text = await response.text()
      let data: any
      
      if (isSSE || text.trim().startsWith('event:') || text.trim().startsWith('data:')) {
        // Parse SSE format
        console.log(`[HTTP] Received SSE response (first 200 chars):`, text.substring(0, 200))
        
        // SSE format: "event: message\ndata: {...}\n\n"
        // Extract the data field from SSE
        const lines = text.split('\n')
        let sseData = ''
        let inDataBlock = false
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            sseData += line.substring(6) // Remove "data: " prefix
            inDataBlock = true
          } else if (line.trim() === '' && inDataBlock) {
            // Empty line after data block - end of message
            break
          } else if (inDataBlock && !line.startsWith('event:') && !line.startsWith('id:')) {
            // Continuation of data (multi-line JSON)
            sseData += '\n' + line
          }
        }
        
        if (sseData) {
          try {
            data = JSON.parse(sseData)
            console.log(`[HTTP] Parsed SSE data successfully`)
          } catch (e) {
            // If SSE data isn't JSON, treat as plain text
            console.log(`[HTTP] SSE data is not JSON, treating as text`)
            data = { result: { content: [{ type: 'text', text: sseData }] } }
          }
        } else {
          // No data field found, try parsing entire response as JSON
          try {
            data = JSON.parse(text)
          } catch (e) {
            // Last resort: return text content
            data = { result: { content: [{ type: 'text', text }] } }
          }
        }
      } else {
        // Standard JSON response
        try {
          data = JSON.parse(text)
        } catch (e) {
          // If JSON parsing fails, return text content
          console.log(`[HTTP] Failed to parse as JSON, treating as text`)
          data = { result: { content: [{ type: 'text', text }] } }
        }
      }

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
      const message = error instanceof Error ? `${error.message}` + (error.stack ? `\n${error.stack}` : '') : String(error)
      return {
        result: {
          content: [
            {
              type: 'text',
              text: message,
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
      console.log(`[STDIO] GEMINI_API_KEY present: ${!!env.GEMINI_API_KEY}`)
      console.log(`[STDIO] GEMINI_API_KEY value (first 10 chars): ${env.GEMINI_API_KEY ? env.GEMINI_API_KEY.substring(0, 10) + '...' : 'MISSING'}`)
      console.log(`[STDIO] API_KEY present: ${!!env.API_KEY}`)
      
      // Merge with process.env but ensure our env vars take precedence
      const mergedEnv = { ...process.env, ...env }
      
      // Spawn the MCP server process
      // Use shell: true for npx to work correctly
      const proc = spawn(server.command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true, // npx requires shell: true
        env: mergedEnv,
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
            } else if (message.error) {
              // Handle error response from MCP server
              console.error(`[STDIO] MCP server returned error:`, JSON.stringify(message.error, null, 2))
              const errorMessage = message.error.message || JSON.stringify(message.error)
              
              // Check if it's a Gemini API quota error
              if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
                reject(new Error(`Gemini API quota exceeded: ${errorMessage.substring(0, 200)}. Please check your API key quota or wait for the rate limit to reset.`))
              } else {
                reject(new Error(`MCP tool error: ${errorMessage}`))
              }
            } else if (message.result) {
              // Log the raw JSON-RPC result for debugging
              console.log(`[STDIO] ===== RAW JSON-RPC RESULT =====`)
              console.log(`[STDIO] Full message.result:`, JSON.stringify(message.result, null, 2))
              console.log(`[STDIO] message.result.content:`, JSON.stringify(message.result.content, null, 2))
              console.log(`[STDIO] message.result.content type:`, typeof message.result.content)
              console.log(`[STDIO] message.result.content isArray:`, Array.isArray(message.result.content))
              if (message.result.content && Array.isArray(message.result.content)) {
                message.result.content.forEach((item: any, index: number) => {
                  console.log(`[STDIO] Content item ${index}:`, JSON.stringify(item, null, 2))
                  console.log(`[STDIO] Content item ${index} keys:`, Object.keys(item))
                })
              }
              console.log(`[STDIO] =================================`)
              
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
              
              console.log(`[STDIO] Tool call completed for ${server.serverId}`)
              console.log(`[STDIO] Converted content array length:`, content.length)
              console.log(`[STDIO] First content item type:`, content[0]?.type || 'unknown')
              console.log(`[STDIO] First content item has text:`, !!content[0]?.text)
              console.log(`[STDIO] First content item has data:`, !!content[0]?.data)
              console.log(`[STDIO] First content item has url:`, !!content[0]?.url)
              if (content[0]?.text) {
                console.log(`[STDIO] First content item text (first 500 chars):`, content[0].text.substring(0, 500))
              }
              
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
    
    // First, get env from server.env (primary source)
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
      // Also check if API key is directly in metadata
      if (metadata.apiKey) {
        env.GEMINI_API_KEY = String(metadata.apiKey)
      }
    }
    
    // Ensure GEMINI_API_KEY is set if API_KEY exists (common alias)
    if (env.API_KEY && !env.GEMINI_API_KEY) {
      env.GEMINI_API_KEY = env.API_KEY
    }
    
    // Log what we're returning for debugging
    console.log(`[getServerEnv] Server ${server.serverId} env keys:`, Object.keys(env))
    console.log(`[getServerEnv] GEMINI_API_KEY set: ${!!env.GEMINI_API_KEY}`)
    
    return env
  }
}

export const mcpInvokeService = new MCPInvokeService()

