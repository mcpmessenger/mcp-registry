import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

interface EnvConfig {
  database: {
    url: string
    provider: 'sqlite' | 'postgresql'
  }
  server: {
    port: number
    nodeEnv: string
    corsOrigin: string
  }
  google: {
    visionApiKey: string
    geminiApiKey: string
    geminiModelName?: string
    oauth: {
      clientId: string
      clientSecret: string
      redirectUri: string
    }
  }
  openai: {
    apiKey: string
  }
  kafka: {
    brokers: string[]
    clientId: string
    groupId: string
    topics: {
      designRequests: string
      designReady: string
    }
  }
}

function getDatabaseProvider(url: string): 'sqlite' | 'postgresql' {
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    return 'postgresql'
  }
  return 'sqlite'
}

export const env: EnvConfig = {
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
    // Use separate keys if provided, otherwise fall back to a single key
    visionApiKey: process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    geminiApiKey: process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    // Model name with specific version for better compatibility (e.g., gemini-1.5-flash-001)
    geminiModelName: process.env.GEMINI_MODEL_NAME,
    oauth: {
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || `http://localhost:${process.env.PORT || '3001'}/api/auth/google/callback`,
    },
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  kafka: {
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    clientId: process.env.KAFKA_CLIENT_ID || 'mcp-registry-api-gateway',
    groupId: process.env.KAFKA_GROUP_ID || 'mcp-registry-workers',
    topics: {
      designRequests: process.env.KAFKA_TOPIC_DESIGN_REQUESTS || 'design-requests',
      designReady: process.env.KAFKA_TOPIC_DESIGN_READY || 'design-ready',
    },
  },
}

// Validation
if (!env.google.visionApiKey && env.server.nodeEnv === 'production') {
  console.warn('Warning: GOOGLE_VISION_API_KEY is not set')
}

if (!env.google.geminiApiKey && env.server.nodeEnv === 'production') {
  console.warn('Warning: GOOGLE_GEMINI_API_KEY is not set')
}

if (!env.openai.apiKey && env.server.nodeEnv === 'production') {
  console.warn('Warning: OPENAI_API_KEY is not set (required for Whisper transcription)')
}

if (!env.google.oauth.clientId && env.server.nodeEnv === 'production') {
  console.warn('Warning: GOOGLE_OAUTH_CLIENT_ID is not set (required for OAuth authentication)')
}

export default env
