import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { env } from './config/env'

// Load environment variables
dotenv.config()

// Import routes
import v0ServersRouter from './routes/v0/servers'
import mcpToolsRouter from './routes/mcp/tools'
import documentsRouter from './routes/documents/analyze'

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

// API routes
app.use('/v0.1', v0ServersRouter)
app.use('/api/mcp/tools', mcpToolsRouter)
app.use('/api/documents', documentsRouter)

// 404 handler
app.use((req: Request, res: Response) => {
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
const PORT = parseInt(process.env.PORT || String(env.server.port || 8080), 10)

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

