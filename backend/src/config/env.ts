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

function parsePulsarServiceUrl(value?: string) {
  if (!value) {
    return 'pulsar://localhost:6650'
  }
  return value.trim()
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
      toolSignalsRetry5s: process.env.KAFKA_TOPIC_TOOL_SIGNALS_RETRY_5S || 'tool-signals-retry-5s',
      toolSignalsRetry30s: process.env.KAFKA_TOPIC_TOOL_SIGNALS_RETRY_30S || 'tool-signals-retry-30s',
      toolSignalsDlq: process.env.KAFKA_TOPIC_TOOL_SIGNALS_DLQ || 'tool-signals-dlq',
      orchestratorPlans: process.env.KAFKA_TOPIC_ORCHESTRATOR_PLANS || 'orchestrator-plans',
      orchestratorResults: process.env.KAFKA_TOPIC_ORCHESTRATOR_RESULTS || 'orchestrator-results',
      // Registry-specific topics (for compatibility, even though Kafka is being deprecated)
      registrations: process.env.KAFKA_TOPIC_REGISTRATIONS || 'registrations-global',
      sessions: process.env.KAFKA_TOPIC_SESSIONS || 'sessions',
      activity: process.env.KAFKA_TOPIC_ACTIVITY || 'events-activity',
    },
  },
  pulsar: {
    enabled: process.env.USE_PULSAR_KOP === 'true' || process.env.ENABLE_PULSAR === 'true',
    serviceUrl: parsePulsarServiceUrl(process.env.PULSAR_SERVICE_URL),
    httpUrl: process.env.PULSAR_HTTP_URL || 'http://localhost:8080',
    // For KoP compatibility, use Kafka brokers config pointing to Pulsar KoP endpoint
    // KoP listens on port 9092 by default (same as Kafka)
    kopBrokers: parseKafkaBrokers(process.env.PULSAR_KOP_BROKERS || process.env.KAFKA_BROKERS),
    namespace: process.env.PULSAR_NAMESPACE || 'public/default',
    // Topic names remain the same for KoP compatibility
    topics: {
      userRequests: process.env.PULSAR_TOPIC_USER_REQUESTS || process.env.KAFKA_TOPIC_USER_REQUESTS || 'user-requests',
      toolSignals: process.env.PULSAR_TOPIC_TOOL_SIGNALS || process.env.KAFKA_TOPIC_TOOL_SIGNALS || 'tool-signals',
      toolSignalsRetry5s: process.env.PULSAR_TOPIC_TOOL_SIGNALS_RETRY_5S || process.env.KAFKA_TOPIC_TOOL_SIGNALS_RETRY_5S || 'tool-signals-retry-5s',
      toolSignalsRetry30s: process.env.PULSAR_TOPIC_TOOL_SIGNALS_RETRY_30S || process.env.KAFKA_TOPIC_TOOL_SIGNALS_RETRY_30S || 'tool-signals-retry-30s',
      toolSignalsDlq: process.env.PULSAR_TOPIC_TOOL_SIGNALS_DLQ || process.env.KAFKA_TOPIC_TOOL_SIGNALS_DLQ || 'tool-signals-dlq',
      orchestratorPlans: process.env.PULSAR_TOPIC_ORCHESTRATOR_PLANS || process.env.KAFKA_TOPIC_ORCHESTRATOR_PLANS || 'orchestrator-plans',
      orchestratorResults: process.env.PULSAR_TOPIC_ORCHESTRATOR_RESULTS || process.env.KAFKA_TOPIC_ORCHESTRATOR_RESULTS || 'orchestrator-results',
      // Registry-specific topics
      registrations: process.env.PULSAR_TOPIC_REGISTRATIONS || 'registrations/global',
      sessions: process.env.PULSAR_TOPIC_SESSIONS || 'sessions',
      activity: process.env.PULSAR_TOPIC_ACTIVITY || 'events/activity',
    },
  },
  mcp: {
    sessionTtl: parseInt(process.env.MCP_SESSION_TTL || '3600', 10), // 1 hour default
    allowedOrigins: process.env.MCP_ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:3000'],
    protocolVersion: process.env.MCP_PROTOCOL_VERSION || '2025-03-26',
  },
}












