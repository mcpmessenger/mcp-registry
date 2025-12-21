import { OAuth2Client } from 'google-auth-library'
import { env } from '../config/env'

/**
 * Google OAuth Service
 * 
 * Handles Google OAuth authentication for user login and token verification.
 * This replaces the simple header-based auth with proper OAuth 2.0 flow.
 */
export class GoogleOAuthService {
  private client: OAuth2Client | null = null

  constructor() {
    if (env.google.oauth.clientId && env.google.oauth.clientSecret) {
      this.client = new OAuth2Client(
        env.google.oauth.clientId,
        env.google.oauth.clientSecret,
        env.google.oauth.redirectUri
      )
      console.log('Google OAuth client initialized')
    } else {
      console.warn('Google OAuth not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET')
    }
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl(state?: string): string {
    if (!this.client) {
      throw new Error('Google OAuth client not initialized')
    }

    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ]

    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state || undefined,
      prompt: 'consent', // Force consent screen to get refresh token
    })
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code: string): Promise<{
    accessToken: string
    refreshToken?: string
    idToken?: string
  }> {
    if (!this.client) {
      throw new Error('Google OAuth client not initialized')
    }

    const { tokens } = await this.client.getToken(code)
    
    if (!tokens.access_token) {
      throw new Error('Failed to get access token')
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      idToken: tokens.id_token || undefined,
    }
  }

  /**
   * Verify ID token and get user info
   */
  async verifyIdToken(idToken: string): Promise<{
    userId: string
    email: string
    name: string
    picture?: string
  }> {
    if (!this.client) {
      throw new Error('Google OAuth client not initialized')
    }

    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: env.google.oauth.clientId,
    })

    const payload = ticket.getPayload()
    if (!payload) {
      throw new Error('Invalid token payload')
    }

    return {
      userId: payload.sub,
      email: payload.email || '',
      name: payload.name || payload.email || 'Unknown',
      picture: payload.picture || undefined,
    }
  }

  /**
   * Verify access token and get user info
   */
  async verifyAccessToken(accessToken: string): Promise<{
    userId: string
    email: string
    name: string
    picture?: string
  }> {
    if (!this.client) {
      throw new Error('Google OAuth client not initialized')
    }

    // Set credentials
    this.client.setCredentials({ access_token: accessToken })

    // Get user info from Google API
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to verify access token')
    }

    const userInfo = await response.json()

    return {
      userId: userInfo.id,
      email: userInfo.email,
      name: userInfo.name || userInfo.email || 'Unknown',
      picture: userInfo.picture || undefined,
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    if (!this.client) {
      throw new Error('Google OAuth client not initialized')
    }

    this.client.setCredentials({ refresh_token: refreshToken })
    const { credentials } = await this.client.refreshAccessToken()

    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token')
    }

    return credentials.access_token
  }

  /**
   * Check if OAuth is configured
   */
  isConfigured(): boolean {
    return this.client !== null && !!env.google.oauth.clientId && !!env.google.oauth.clientSecret
  }
}

export const googleOAuthService = new GoogleOAuthService()
