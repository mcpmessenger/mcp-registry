import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

function getDatabaseProvider(url: string): 'sqlite' | 'postgresql' {
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    return 'postgresql'
  }
  return 'sqlite'
}

function parseKafkaBrokers(value?: string) {
  if (!value) {
    return ['localhost:9092']
  }
  return value.split(',').map(part => part.trim()).filter(Boolean)
}

export const env = {
  database: {
    url: process.env.DATABASE_URL || 'file:./dev.db',
    provider: getDatabaseProvider(process.env.DATABASE_URL || 'file:./dev.db'),
  },
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  google: {
    visionApiKey: process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    geminiApiKey: process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    geminiModelName: process.env.GEMINI_MODEL_NAME,
  },
  kafka: {
    enabled: process.env.ENABLE_KAFKA === 'true',
    brokers: parseKafkaBrokers(process.env.KAFKA_BROKERS),
    clientId: process.env.KAFKA_CLIENT_ID || 'mcp-orchestrator-coordinator',
    groupId: process.env.KAFKA_GROUP_ID || 'mcp-orchestrator-coordinator',
    topics: {
      userRequests: process.env.KAFKA_TOPIC_USER_REQUESTS || 'user-requests',
      toolSignals: process.env.KAFKA_TOPIC_TOOL_SIGNALS || 'tool-signals',
      orchestratorPlans: process.env.KAFKA_TOPIC_ORCHESTRATOR_PLANS || 'orchestrator-plans',
      orchestratorResults: process.env.KAFKA_TOPIC_ORCHESTRATOR_RESULTS || 'orchestrator-results',
    },
  },
}












