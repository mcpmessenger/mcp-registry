import cors from 'cors'
import { env } from '../config/env'

/**
 * CORS configuration for Vercel frontend
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true)
    }

    const allowedOrigins = [
      env.server.corsOrigin,
      'http://localhost:3000',
      'https://vercel.com',
      // Add production frontend URL when available
    ]

    // In development, allow all origins
    if (env.server.nodeEnv === 'development') {
      return callback(null, true)
    }

    // In production, check against whitelist
    if (allowedOrigins.some((allowed) => origin.includes(allowed))) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'X-Total-Count'],
})
