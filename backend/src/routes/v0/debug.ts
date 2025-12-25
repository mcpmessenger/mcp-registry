/**
 * Debug endpoint to check server metadata and HTTP headers
 * Useful for troubleshooting API key issues
 */

import { Router } from 'express'
import { registryService } from '../../services/registry.service'

const router = Router()

// Log when router is initialized
console.log('[Debug Router] Debug router initialized')

/**
 * GET /v0.1/debug/server/:serverId
 * Returns detailed server information including metadata and HTTP headers
 */
router.get('/server/:serverId', async (req, res) => {
  console.log('[Debug Router] Route hit! Path:', req.path, 'Params:', req.params, 'Original URL:', req.originalUrl)
  try {
    const { serverId } = req.params
    const server = await registryService.getServerById(serverId)
    
    if (!server) {
      return res.status(404).json({
        success: false,
        error: `Server ${serverId} not found`,
      })
    }

    const metadata = server.metadata as Record<string, unknown> | undefined
    const httpHeaders = metadata?.httpHeaders as Record<string, unknown> | undefined

    res.json({
      success: true,
      server: {
        serverId: server.serverId,
        name: server.name,
        endpoint: metadata?.endpoint,
        hasMetadata: !!metadata,
        hasHttpHeaders: !!httpHeaders,
        httpHeaders: httpHeaders ? Object.keys(httpHeaders) : [],
        httpHeadersPreview: httpHeaders 
          ? Object.fromEntries(
              Object.entries(httpHeaders).map(([key, value]) => [
                key,
                typeof value === 'string' && key.toLowerCase().includes('key')
                  ? `${String(value).substring(0, 10)}...` 
                  : value
              ])
            )
          : null,
        metadataKeys: metadata ? Object.keys(metadata) : [],
      },
    })
  } catch (error) {
    console.error('[Debug] Error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

export default router

