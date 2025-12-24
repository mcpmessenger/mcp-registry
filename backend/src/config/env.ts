import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

function getDatabaseProvider(url: string): 'sqlite' | 'postgresql' {
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    return 'postgresql'
  }
  return 'sqlite'
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
}


