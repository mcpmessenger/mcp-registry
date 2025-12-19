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
  },
}

// Validation
if (!env.google.visionApiKey && env.server.nodeEnv === 'production') {
  console.warn('Warning: GOOGLE_VISION_API_KEY is not set')
}

if (!env.google.geminiApiKey && env.server.nodeEnv === 'production') {
  console.warn('Warning: GOOGLE_GEMINI_API_KEY is not set')
}

export default env
