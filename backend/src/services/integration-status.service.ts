/**
 * Integration Status Service
 * 
 * Determines the integration status of MCP servers:
 * - active: Fully integrated, tools discovered, tested and working
 * - pre-integration: Registered but tools not discovered or not yet tested
 * - offline: Server unavailable or failing
 */

import type { MCPServer } from '../types/mcp'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export type IntegrationStatus = 'active' | 'pre-integration' | 'offline'

export interface IntegrationStatusResult {
  status: IntegrationStatus
  reason: string
  details: {
    hasTools: boolean
    toolsCount: number
    packageVerified?: boolean
    healthCheckPassed?: boolean
    lastChecked?: Date
  }
}

/**
 * Determine integration status for an MCP server
 */
export async function getIntegrationStatus(server: MCPServer): Promise<IntegrationStatusResult> {
  const details = {
    hasTools: false,
    toolsCount: 0,
    packageVerified: undefined as boolean | undefined,
    healthCheckPassed: undefined as boolean | undefined,
    lastChecked: new Date(),
  }

  // Check if server has tools discovered
  const hasTools = !!(server.tools && Array.isArray(server.tools) && server.tools.length > 0)
  details.hasTools = hasTools
  details.toolsCount = hasTools && server.tools ? server.tools.length : 0

  // For STDIO servers, check if package exists on npm
  if (server.command && server.args && server.args.length > 0) {
    const packageName = server.args[server.args.length - 1]
    if (packageName && !packageName.startsWith('-')) {
      try {
        const packageVerified = await verifyNpmPackage(packageName)
        details.packageVerified = packageVerified
      } catch (error) {
        details.packageVerified = false
      }
    }
  }

  // For HTTP servers, check health endpoint
  if (!server.command && !server.args) {
    const endpoint = getHttpEndpoint(server)
    if (endpoint) {
      try {
        // For Google Maps, skip health check (it doesn't have a /health endpoint)
        // Instead, we'll rely on tool discovery to verify it's working
        if (endpoint.includes('mapstools.googleapis.com')) {
          // Google Maps doesn't have a health endpoint, so we'll mark as undefined
          // and let tool discovery determine if it's working
          details.healthCheckPassed = undefined
        } else {
          const healthCheckPassed = await checkHttpHealth(endpoint)
          details.healthCheckPassed = healthCheckPassed
        }
      } catch (error) {
        details.healthCheckPassed = false
      }
    }
  }

  // Determine status based on checks
  let status: IntegrationStatus = 'pre-integration'
  let reason = ''

  if (hasTools) {
    // Has tools - check if it's actually working
    if (server.command && server.args) {
      // STDIO server - check package
      if (details.packageVerified === false) {
        status = 'pre-integration'
        reason = 'Package not found on npm'
      } else {
        status = 'active'
        reason = 'Tools discovered and package verified'
      }
    } else {
      // HTTP server - check health
      if (details.healthCheckPassed === false) {
        status = 'offline'
        reason = 'Health check failed'
      } else if (details.healthCheckPassed === true) {
        status = 'active'
        reason = 'Tools discovered and health check passed'
      } else {
        status = 'active' // Assume active if tools exist but health check not performed
        reason = 'Tools discovered'
      }
    }
  } else {
    // No tools discovered
    if (server.command && server.args) {
      const packageName = server.args[server.args.length - 1]
      if (details.packageVerified === false) {
        status = 'pre-integration'
        reason = `Package ${packageName} not found on npm, tools not discovered`
      } else {
        status = 'pre-integration'
        reason = 'Tools not yet discovered (package may exist but discovery failed)'
      }
    } else {
      // HTTP server without tools
      const endpoint = getHttpEndpoint(server)
      if (endpoint && endpoint.includes('mapstools.googleapis.com')) {
        status = 'pre-integration'
        reason = 'Tools not yet discovered. Google Maps requires X-Goog-Api-Key header. Add it in HTTP Headers field when editing the server.'
      } else {
        status = 'pre-integration'
        reason = 'Tools not yet discovered'
      }
    }
  }

  return {
    status,
    reason,
    details,
  }
}

/**
 * Verify if an npm package exists
 */
async function verifyNpmPackage(packageName: string): Promise<boolean> {
  try {
    // Remove @ prefix if present and clean up
    const cleanName = packageName.replace(/^@/, '').trim()
    
    // Use npm view to check if package exists
    const { stdout } = await execAsync(`npm view ${packageName} version`, {
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    })
    
    return stdout.trim().length > 0
  } catch (error) {
    // Package doesn't exist or npm error
    return false
  }
}

/**
 * Check HTTP server health endpoint
 */
async function checkHttpHealth(endpoint: string): Promise<boolean> {
  try {
    // Try to construct health check URL
    const baseUrl = endpoint.replace(/\/mcp$/, '').replace(/\/$/, '')
    const healthUrl = `${baseUrl}/health`
    
    // Use http/https modules for compatibility
    const http = await import('http')
    const https = await import('https')
    const url = await import('url')
    
    const parsedUrl = new url.URL(healthUrl)
    const client = parsedUrl.protocol === 'https:' ? https : http
    
    return new Promise((resolve) => {
      const req = client.get(healthUrl, { timeout: 5000 }, (res) => {
        resolve(res.statusCode === 200 || res.statusCode === 204)
      })
      req.on('error', () => resolve(false))
      req.on('timeout', () => {
        req.destroy()
        resolve(false)
      })
    })
  } catch (error) {
    // Health check failed
    return false
  }
}

/**
 * Get HTTP endpoint from server metadata
 */
function getHttpEndpoint(server: MCPServer): string | null {
  if (server.metadata && typeof server.metadata === 'object') {
    const metadata = server.metadata as Record<string, unknown>
    if (typeof metadata.endpoint === 'string') {
      return metadata.endpoint
    }
  }
  
  if (server.manifest && typeof server.manifest === 'object') {
    const manifest = server.manifest as Record<string, unknown>
    if (typeof manifest.endpoint === 'string') {
      return manifest.endpoint
    }
  }
  
  return null
}

/**
 * Batch check integration status for multiple servers
 */
export async function getBatchIntegrationStatus(
  servers: MCPServer[]
): Promise<Map<string, IntegrationStatusResult>> {
  const results = new Map<string, IntegrationStatusResult>()
  
  // Process in parallel with concurrency limit
  const concurrency = 5
  for (let i = 0; i < servers.length; i += concurrency) {
    const batch = servers.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(async (server) => {
        const status = await getIntegrationStatus(server)
        return [server.serverId, status] as [string, IntegrationStatusResult]
      })
    )
    
    batchResults.forEach(([serverId, status]) => {
      results.set(serverId, status)
    })
  }
  
  return results
}

