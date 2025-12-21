import { Request, Response, NextFunction } from 'express'
import { googleOAuthService } from '../services/google-oauth.service'

/**
 * Extend Express Request to include user info
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string
        email: string
        name: string
        picture?: string
      }
    }
  }
}

/**
 * Authentication middleware
 * Verifies Google OAuth token from Authorization header or session
 */
export async function authenticateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Skip authentication if OAuth is not configured (fallback to header-based)
    if (!googleOAuthService.isConfigured()) {
      const headerUserId = req.headers['x-user-id']
      if (headerUserId) {
        req.user = {
          userId: typeof headerUserId === 'string' ? headerUserId : headerUserId[0],
          email: '',
          name: 'Anonymous',
        }
      }
      return next()
    }

    // Try to get token from Authorization header
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      
      try {
        // Try to verify as ID token first
        const userInfo = await googleOAuthService.verifyIdToken(token)
        req.user = userInfo
        return next()
      } catch (idTokenError) {
        // If ID token verification fails, try as access token
        try {
          const userInfo = await googleOAuthService.verifyAccessToken(token)
          req.user = userInfo
          return next()
        } catch (accessTokenError) {
          // Both failed, continue to check session
        }
      }
    }

    // Try to get from session (if using cookies)
    // This would require session middleware to be set up
    // For now, we'll allow anonymous access but mark it
    
    // If no authentication found, allow anonymous but warn
    if (req.path.includes('/publish')) {
      // For publish endpoint, we might want to require auth
      // But for now, allow anonymous with a warning
      console.warn('Publish request without authentication')
    }

    next()
  } catch (error) {
    console.error('Authentication error:', error)
    next(error)
  }
}

/**
 * Require authentication middleware
 * Returns 401 if user is not authenticated
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please authenticate using Google OAuth',
    })
    return
  }
  next()
}
