import { Router, Request, Response } from 'express'
import { googleOAuthService } from '../../services/google-oauth.service'

const router = Router()

/**
 * GET /api/auth/google
 * Initiate Google OAuth login flow
 * Redirects user to Google OAuth consent screen
 */
router.get('/google', (req: Request, res: Response) => {
  try {
    if (!googleOAuthService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Google OAuth not configured',
        message: 'Please set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET',
      })
    }

    // Optional: store state for CSRF protection
    const state = req.query.state as string | undefined
    
    const authUrl = googleOAuthService.getAuthUrl(state)
    res.redirect(authUrl)
  } catch (error) {
    console.error('OAuth initiation error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to initiate OAuth flow',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 * Exchanges authorization code for tokens
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'OAuth error',
        message: error,
      })
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing authorization code',
      })
    }

    // Exchange code for tokens
    const tokens = await googleOAuthService.getTokens(code)

    // Verify ID token to get user info
    let userInfo
    if (tokens.idToken) {
      userInfo = await googleOAuthService.verifyIdToken(tokens.idToken)
    } else if (tokens.accessToken) {
      userInfo = await googleOAuthService.verifyAccessToken(tokens.accessToken)
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to get user information',
      })
    }

    // In a production app, you would:
    // 1. Store tokens securely (encrypted in database or secure cookies)
    // 2. Create/update user session
    // 3. Redirect to frontend with session token

    // For now, return tokens (frontend should store securely)
    // In production, use HTTP-only cookies or secure session storage
    res.json({
      success: true,
      message: 'Authentication successful',
      user: userInfo,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        // Don't return ID token in production, use it server-side only
        idToken: tokens.idToken,
      },
    })
  } catch (error) {
    console.error('OAuth callback error:', error)
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * POST /api/auth/google/verify
 * Verify an access token or ID token
 * Useful for frontend to check if token is still valid
 */
router.post('/google/verify', async (req: Request, res: Response) => {
  try {
    const { token, tokenType } = req.body

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token required',
      })
    }

    let userInfo
    if (tokenType === 'id_token' || token.includes('.')) {
      // Assume it's an ID token if it contains dots (JWT format)
      userInfo = await googleOAuthService.verifyIdToken(token)
    } else {
      // Assume it's an access token
      userInfo = await googleOAuthService.verifyAccessToken(token)
    }

    res.json({
      success: true,
      user: userInfo,
    })
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      message: error instanceof Error ? error.message : 'Token verification failed',
    })
  }
})

/**
 * POST /api/auth/google/refresh
 * Refresh an access token using refresh token
 */
router.post('/google/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required',
      })
    }

    const accessToken = await googleOAuthService.refreshAccessToken(refreshToken)

    res.json({
      success: true,
      accessToken,
    })
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Failed to refresh token',
      message: error instanceof Error ? error.message : 'Token refresh failed',
    })
  }
})

export default router
