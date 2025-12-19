import express from 'express'
import http from 'http'
import { corsMiddleware } from './middleware/cors.middleware'
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware'
import { env } from './config/env'
import { prisma } from './config/database'
import { webSocketService } from './services/websocket.service'

// Routes
import v0ServersRouter from './routes/v0/servers'
import mcpToolsRouter from './routes/mcp/tools'
import streamsRouter from './routes/streams/jobs'
import debugRouter from './routes/debug'

const app = express()
const server = http.createServer(app)

// Initialize WebSocket server
webSocketService.initialize(server)

// Middleware
app.use(corsMiddleware)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.server.nodeEnv,
  })
})

// API Routes
app.use('/v0', v0ServersRouter)
app.use('/api/mcp/tools', mcpToolsRouter)
app.use('/api/streams', streamsRouter)
app.use('/api/debug', debugRouter)

// 404 handler
app.use(notFoundMiddleware)

// Error handler (must be last)
app.use(errorMiddleware)

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Shutting down gracefully...')
  
  // Close WebSocket server
  webSocketService.close()
  
  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed')
  })
  
  // Disconnect Prisma
  await prisma.$disconnect()
  console.log('Database disconnected')
  
  process.exit(0)
}

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

// Start server
const PORT = env.server.port

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📡 Environment: ${env.server.nodeEnv}`)
  console.log(`🗄️  Database: ${env.database.provider}`)
  console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`)
  console.log(`📋 Registry API: http://localhost:${PORT}/v0/servers`)
  console.log(`🛠️  MCP Tools: http://localhost:${PORT}/api/mcp/tools`)
  console.log(`📊 Streams: http://localhost:${PORT}/api/streams/jobs/:jobId`)
  console.log(`\n🔑 API Keys Status:`)
  console.log(`   Gemini API: ${env.google.geminiApiKey ? '✅ Set' : '❌ Not set'}`)
  console.log(`   Vision API: ${env.google.visionApiKey ? '✅ Set' : '⚠️  Not set (optional)'}`)
})

export default app
