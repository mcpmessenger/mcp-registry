import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { env } from './config/env'

// Load environment variables
dotenv.config()

// Import routes
import v0ServersRouter from './routes/v0/servers'
import debugRouter from './routes/v0/debug'
import mcpToolsRouter from './routes/mcp/tools'
import documentsRouter from './routes/documents/analyze'
import { registryService } from './services/registry.service'

const app = express()

// Middleware
app.use(cors({
  origin: env.server.corsOrigin || '*',
  credentials: true,
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.server.nodeEnv,
  })
})

// Simple test route to verify routing works
app.get('/test-debug', (req: Request, res: Response) => {
  console.log('[TEST] Test route hit!')
  res.json({ success: true, message: 'Test route works', timestamp: new Date().toISOString() })
})

// API routes
// More specific routes must come before less specific ones

// Request logger - placed before routes to see all requests
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log('[Server] === REQUEST ===', req.method, req.originalUrl, 'Path:', req.path)
  next()
})

// Add debug route directly to main app first (before v0.1 router)
// Use regex to match serverId with dots and slashes (e.g., com.google/maps-mcp)
app.get(/^\/v0\.1\/debug\/server\/(.+)$/, async (req, res, next) => {
  console.log('[Server] ===== DIRECT DEBUG ROUTE HIT =====')
  console.log('[Server] Method:', req.method)
  console.log('[Server] Path:', req.path)
  console.log('[Server] Original URL:', req.originalUrl)
  console.log('[Server] Params:', req.params)
  console.log('[Server] ===================================')
  try {
    // Extract serverId from the regex match (stored in req.params[0])
    const serverId = req.params[0] || req.path.replace('/v0.1/debug/server/', '')
    console.log('[Server] Extracted serverId:', serverId)
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
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

console.log('[Server] Registering debug router at /v0.1/debug')
app.use('/v0.1/debug', debugRouter)
console.log('[Server] Registering v0 servers router at /v0.1')
app.use('/v0.1', v0ServersRouter)
app.use('/api/mcp/tools', mcpToolsRouter)
app.use('/api/documents', documentsRouter)

// 404 handler
app.use((req: Request, res: Response) => {
  console.log('[Server] ===== 404 HANDLER =====')
  console.log('[Server] Method:', req.method)
  console.log('[Server] Path:', req.path)
  console.log('[Server] Original URL:', req.originalUrl)
  console.log('[Server] =======================')
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  })
})

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({
    error: 'Internal Server Error',
    message: env.server.nodeEnv === 'development' ? err.message : 'An error occurred',
  })
})

// Start server
// Cloud Run sets PORT automatically, fallback to env config or 8080
const PORT: number = parseInt(process.env.PORT || String(env.server.port || 8080), 10)

// Initialize Kafka producer for discovery events (if available)
if (process.env.KAFKA_BROKERS || process.env.ENABLE_KAFKA === 'true') {
  import('./services/mcp-discovery.service').then(async ({ initializeKafkaProducer }) => {
    try {
      await initializeKafkaProducer()
    } catch (error) {
      console.warn('[Server] Kafka initialization failed, continuing without event streaming:', error)
    }
  }).catch(() => {
    // Kafka optional, continue without it
  })
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📊 Environment: ${env.server.nodeEnv}`)
  console.log(`🌐 CORS origin: ${env.server.corsOrigin}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

export default app

