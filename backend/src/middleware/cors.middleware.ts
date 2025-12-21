import cors from 'cors'
import { env } from '../config/env'

/**
 * CORS configuration for MCP Registry API
 * 
 * Per MCP v0.1 specification, browser-based tools need CORS support to fetch
 * registry metadata from different domains. This configuration ensures proper
 * cross-origin resource sharing for the registry API endpoints.
 * 
 * Reference: Official MCP Registry Developer Guide
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
      // Allow all vercel.app subdomains for flexibility
    ]

    // In development, allow all origins (per MCP spec recommendation for browser tools)
    if (env.server.nodeEnv === 'development') {
      return callback(null, true)
    }

    // In production, check against whitelist
    // Also allow any *.vercel.app domain for flexibility
    const isVercelDomain = origin.includes('.vercel.app')
    if (allowedOrigins.some((allowed) => origin.includes(allowed)) || isVercelDomain) {
      callback(null, true)
    } else {
      console.warn(`CORS blocked origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}, Vercel domains`)
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Id'],
  exposedHeaders: ['Content-Type', 'X-Total-Count'],
})
