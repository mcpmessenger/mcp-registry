import { Router } from 'express'
import { env } from '../config/env'
import { googleGeminiClient } from '../integrations/google-gemini'

const router = Router()

/**
 * GET /api/debug/config
 * Debug endpoint to check configuration (API keys status, etc.)
 * Only available in development mode
 */
router.get('/config', (req, res) => {
  if (env.server.nodeEnv === 'production') {
    return res.status(403).json({
      error: 'Debug endpoint not available in production',
    })
  }

  res.json({
    environment: env.server.nodeEnv,
    database: {
      provider: env.database.provider,
      connected: true, // Assume connected if we got here
    },
    google: {
      geminiApiKey: {
        set: !!env.google.geminiApiKey,
        length: env.google.geminiApiKey?.length || 0,
        prefix: env.google.geminiApiKey?.substring(0, 10) || 'not set',
      },
      visionApiKey: {
        set: !!env.google.visionApiKey,
        length: env.google.visionApiKey?.length || 0,
        prefix: env.google.visionApiKey?.substring(0, 10) || 'not set',
      },
    },
    clients: {
      gemini: {
        initialized: googleGeminiClient.isInitialized(),
      },
    },
  })
})

export default router
