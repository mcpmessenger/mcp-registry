import express from 'express'
import http from 'http'
import { corsMiddleware } from './middleware/cors.middleware'
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware'
import { env } from './config/env'
import { prisma } from './config/database'
import { webSocketService } from './services/websocket.service'
import { initializeKafka, shutdownKafka, kafka } from './config/kafka'
import { kafkaConsumerService } from './services/kafka-consumer.service'
import { DesignRequestConsumerService } from './services/design-request-consumer.service'

// Routes
import v0ServersRouter from './routes/v0/servers'
import v0InvokeRouter from './routes/v0/invoke'
import mcpToolsRouter from './routes/mcp/tools'
import streamsRouter from './routes/streams/jobs'
import audioRouter from './routes/audio/transcribe'
import documentsRouter from './routes/documents/analyze'
import debugRouter from './routes/debug'
import googleAuthRouter from './routes/auth/google'
import mcpOAuthRouter from './routes/auth/mcp-oauth'
import memoryRouter from './routes/memory'
import { eventBusConsumerService } from './services/event-bus-consumer.service'

const app = express()
const server = http.createServer(app)

// Initialize WebSocket server
webSocketService.initialize(server)

// Initialize Kafka and consumers
let designRequestConsumer: DesignRequestConsumerService | null = null

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

// API Routes - MCP v0.1 specification
app.use('/v0.1', v0ServersRouter)
app.use('/v0.1', v0InvokeRouter)
app.use('/api/auth', googleAuthRouter)
app.use('/api/auth/mcp', mcpOAuthRouter)
app.use('/api/memory', memoryRouter)
app.use('/api/mcp/tools', mcpToolsRouter)
app.use('/api/streams', streamsRouter)
app.use('/api/audio', audioRouter)
app.use('/api/documents', documentsRouter)
app.use('/api/debug', debugRouter)

// 404 handler
app.use(notFoundMiddleware)

// Error handler (must be last)
app.use(errorMiddleware)

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Shutting down gracefully...')
  
  // Stop Kafka consumers
  if (designRequestConsumer) {
    await designRequestConsumer.stop()
  }
  await kafkaConsumerService.stop()
  await eventBusConsumerService.stop()
  
  // Close Kafka connections
  await shutdownKafka()
  
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

// Start server with Kafka initialization
const PORT = env.server.port

async function startServer() {
  try {
    // Initialize Kafka (central nervous system) - optional for basic MCP functionality
    console.log('🔄 Initializing Kafka...')
    const kafkaAvailable = await initializeKafka()

    // Only start Kafka consumers if Kafka is available
    if (kafkaAvailable) {
      // Start design request consumer (multimodal worker)
      console.log('🔄 Starting design request consumer...')
      designRequestConsumer = new DesignRequestConsumerService(kafka)
      await designRequestConsumer.start()

      // Start design ready consumer (for WebSocket push)
      console.log('🔄 Starting design ready consumer...')
      await kafkaConsumerService.start()

      // Start event bus consumer (for cross-server communication)
      console.log('🔄 Starting event bus consumer...')
      await eventBusConsumerService.start()

      // Register example workflows
      const { setupVisionToResearcherWorkflow } = await import('./services/workflow-example.service')
      setupVisionToResearcherWorkflow()
    } else {
      console.log('⚠️  Skipping Kafka consumers - async design generation disabled')
    }

    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`)
      console.log(`📡 Environment: ${env.server.nodeEnv}`)
      console.log(`🗄️  Database: ${env.database.provider}`)
      console.log(`📡 Kafka Brokers: ${env.kafka.brokers.join(', ')}`)
      console.log(`📡 Kafka Topics: ${env.kafka.topics.designRequests}, ${env.kafka.topics.designReady}`)
      console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`)
      console.log(`📋 Registry API: http://localhost:${PORT}/v0.1/servers`)
      console.log(`📤 Publish API: POST http://localhost:${PORT}/v0.1/publish`)
      console.log(`🛠️  MCP Tools: http://localhost:${PORT}/api/mcp/tools`)
      console.log(`📊 Streams: http://localhost:${PORT}/api/streams/jobs/:jobId`)
      console.log(`🎤 Audio Transcription: POST http://localhost:${PORT}/api/audio/transcribe`)
      console.log(`📄 Document Analysis: POST http://localhost:${PORT}/api/documents/analyze`)
      console.log(`\n🔑 API Keys Status:`)
      console.log(`   Gemini API: ${env.google.geminiApiKey ? '✅ Set' : '❌ Not set'}`)
      console.log(`   Vision API: ${env.google.visionApiKey ? '✅ Set' : '⚠️  Not set (optional)'}`)
      console.log(`   OpenAI API: ${env.openai.apiKey ? '✅ Set' : '❌ Not set (required for Whisper transcription)'}`)
      console.log(`   Google OAuth: ${env.google.oauth.clientId ? '✅ Configured' : '⚠️  Not configured (using header-based auth)'}`)
      if (env.google.oauth.clientId) {
        console.log(`   OAuth Login: GET http://localhost:${PORT}/api/auth/google`)
      }
      console.log(`\n✨ Event-Driven Architecture (EDA) Active`)
      console.log(`   Design requests are processed asynchronously via Kafka`)
      console.log(`   Frontend receives real-time updates via WebSocket`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

export default app
