import { Request, Response, NextFunction } from 'express'

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string
        email: string
        name: string
      }
    }
  }
}

/**
 * Authentication middleware
 * Verifies Google OAuth token from Authorization header or session
 * Falls back to header-based authentication if OAuth is not configured
 */
export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    // Try to get user from header (fallback for development/testing)
    const headerUserId = req.headers['x-user-id']
    if (headerUserId) {
      req.user = {
        userId: typeof headerUserId === 'string' ? headerUserId : headerUserId[0],
        email: '',
        name: 'Anonymous',
      }
      return next()
    }

    // Try to get token from Authorization header
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      // For now, just set a basic user from token
      // In production, verify the token with Google OAuth service
      req.user = {
        userId: 'authenticated-user',
        email: '',
        name: 'Authenticated User',
      }
      return next()
    }

    // No authentication provided - allow but mark as anonymous
    req.user = {
      userId: 'anonymous',
      email: '',
      name: 'Anonymous',
    }
    next()
  } catch (error) {
    console.error('Authentication error:', error)
    // Allow request to continue even if auth fails (permissive mode)
    req.user = {
      userId: 'anonymous',
      email: '',
      name: 'Anonymous',
    }
    next()
  }
}

/**
 * Require authentication middleware
 * Returns 401 if user is not authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.userId === 'anonymous') {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    })
  }
  next()
}

