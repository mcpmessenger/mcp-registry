import { prisma } from '../config/database'
import { tokenEncryptionService } from './token-encryption.service'
import { registryService } from './registry.service'

export interface MCPOAuthConfig {
  authorizationUrl: string
  tokenUrl: string
  clientId: string
  clientSecret: string
  scopes: string[]
  redirectUri: string
}

export class MCPOAuthService {
  /**
   * Register OAuth configuration for an MCP server
   */
  async registerAuthConfig(
    serverId: string,
    config: MCPOAuthConfig
  ): Promise<void> {
    await prisma.mcpServer.update({
      where: { serverId },
      data: {
        authConfig: JSON.stringify(config),
      },
    })
  }

  /**
   * Initiate OAuth flow for a server
   */
  async getAuthorizationUrl(serverId: string, state?: string): Promise<string> {
    const server = await prisma.mcpServer.findUnique({
      where: { serverId },
    })

    if (!server || !server.authConfig) {
      throw new Error(`Server ${serverId} does not have OAuth configured`)
    }

    const config: MCPOAuthConfig = JSON.parse(server.authConfig)
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      ...(state && { state }),
    })

    return `${config.authorizationUrl}?${params.toString()}`
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(
    serverId: string,
    code: string
  ): Promise<void> {
    const server = await prisma.mcpServer.findUnique({
      where: { serverId },
    })

    if (!server || !server.authConfig) {
      throw new Error(`Server ${serverId} does not have OAuth configured`)
    }

    const config: MCPOAuthConfig = JSON.parse(server.authConfig)

    // Exchange code for tokens
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const tokens = await response.json()

    // Encrypt and store tokens
    const encrypted = await tokenEncryptionService.encrypt({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
    })

    // Calculate expiration
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null

    await prisma.mcpServer.update({
      where: { serverId },
      data: {
        encryptedTokens: encrypted,
        tokenExpiresAt: expiresAt,
      },
    })
  }

  /**
   * Get decrypted tokens for a server
   */
  async getTokens(serverId: string): Promise<{
    accessToken: string
    refreshToken?: string
    idToken?: string
  }> {
    const server = await prisma.mcpServer.findUnique({
      where: { serverId },
    })

    if (!server || !server.encryptedTokens) {
      throw new Error(`Server ${serverId} does not have stored tokens`)
    }

    // Check expiration
    if (server.tokenExpiresAt && server.tokenExpiresAt < new Date()) {
      // Refresh token if available
      if (server.encryptedTokens) {
        const tokens = await tokenEncryptionService.decrypt(server.encryptedTokens)
        if (tokens.refreshToken) {
          await this.refreshToken(serverId)
          return this.getTokens(serverId) // Recursive call after refresh
        }
      }
      throw new Error(`Tokens expired for server ${serverId}`)
    }

    return tokenEncryptionService.decrypt(server.encryptedTokens)
  }

  /**
   * Refresh access token
   */
  async refreshToken(serverId: string): Promise<void> {
    const server = await prisma.mcpServer.findUnique({
      where: { serverId },
    })

    if (!server || !server.authConfig || !server.encryptedTokens) {
      throw new Error(`Server ${serverId} does not have OAuth configured`)
    }

    const config: MCPOAuthConfig = JSON.parse(server.authConfig)
    const tokens = await tokenEncryptionService.decrypt(server.encryptedTokens)

    if (!tokens.refreshToken) {
      throw new Error(`No refresh token available for server ${serverId}`)
    }

    // Refresh token
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const newTokens = await response.json()

    // Encrypt and store new tokens
    const encrypted = await tokenEncryptionService.encrypt({
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token || tokens.refreshToken,
      idToken: newTokens.id_token || tokens.idToken,
    })

    const expiresAt = newTokens.expires_in
      ? new Date(Date.now() + newTokens.expires_in * 1000)
      : null

    await prisma.mcpServer.update({
      where: { serverId },
      data: {
        encryptedTokens: encrypted,
        tokenExpiresAt: expiresAt,
      },
    })
  }
}

export const mcpOAuthService = new MCPOAuthService()
