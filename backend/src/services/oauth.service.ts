import { prisma } from '../config/database'
import { randomBytes, createHash } from 'crypto'

/**
 * OAuth 2.1 Service
 * 
 * Implements OAuth 2.1 client registry and consent storage.
 * This acts as an OAuth proxy to ensure only authorized users
 * can trigger high-cost generative tools.
 */
export class OAuthService {
  /**
   * Register a new OAuth client
   */
  async registerClient(clientData: {
    clientId: string
    clientName: string
    redirectUris: string[]
    scopes: string[]
  }): Promise<{
    clientId: string
    clientSecret: string
  }> {
    // Generate client secret
    const clientSecret = randomBytes(32).toString('hex')
    const hashedSecret = createHash('sha256').update(clientSecret).digest('hex')

    await prisma.oAuthClient.create({
      data: {
        clientId: clientData.clientId,
        clientSecret: hashedSecret,
        clientName: clientData.clientName,
        redirectUris: JSON.stringify(clientData.redirectUris),
        scopes: JSON.stringify(clientData.scopes),
      },
    })

    return {
      clientId: clientData.clientId,
      clientSecret, // Return plain secret only once (for client to store)
    }
  }

  /**
   * Validate OAuth client credentials
   */
  async validateClient(clientId: string, clientSecret?: string): Promise<boolean> {
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId },
    })

    if (!client || !client.isActive) {
      return false
    }

    // If secret provided, validate it
    if (clientSecret) {
      const hashedSecret = createHash('sha256').update(clientSecret).digest('hex')
      return client.clientSecret === hashedSecret
    }

    return true
  }

  /**
   * Store user consent for a client
   */
  async storeConsent(
    clientId: string,
    userId: string,
    scopes: string[],
    expiresAt?: Date
  ): Promise<void> {
    // Check if client exists
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId },
    })

    if (!client) {
      throw new Error(`OAuth client ${clientId} not found`)
    }

    // Validate scopes are allowed for this client
    const allowedScopes = JSON.parse(client.scopes) as string[]
    const invalidScopes = scopes.filter((scope) => !allowedScopes.includes(scope))
    if (invalidScopes.length > 0) {
      throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}`)
    }

    // Upsert consent
    await prisma.oAuthConsent.upsert({
      where: {
        clientId_userId: {
          clientId,
          userId,
        },
      },
      update: {
        scopes: JSON.stringify(scopes),
        expiresAt,
        revokedAt: null,
        isActive: true,
      },
      create: {
        clientId,
        userId,
        scopes: JSON.stringify(scopes),
        expiresAt,
      },
    })
  }

  /**
   * Revoke user consent for a client
   */
  async revokeConsent(clientId: string, userId: string): Promise<void> {
    await prisma.oAuthConsent.updateMany({
      where: {
        clientId,
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    })
  }

  /**
   * Check if user has valid consent for a client and scopes
   */
  async hasValidConsent(
    clientId: string,
    userId: string,
    requiredScopes: string[]
  ): Promise<boolean> {
    const consent = await prisma.oAuthConsent.findUnique({
      where: {
        clientId_userId: {
          clientId,
          userId,
        },
      },
    })

    if (!consent || !consent.isActive || consent.revokedAt) {
      return false
    }

    // Check expiration
    if (consent.expiresAt && consent.expiresAt < new Date()) {
      return false
    }

    // Check scopes
    const consentedScopes = JSON.parse(consent.scopes) as string[]
    const hasAllScopes = requiredScopes.every((scope) => consentedScopes.includes(scope))

    return hasAllScopes
  }

  /**
   * Get client information
   */
  async getClient(clientId: string) {
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId },
    })

    if (!client) {
      return null
    }

    return {
      clientId: client.clientId,
      clientName: client.clientName,
      redirectUris: JSON.parse(client.redirectUris) as string[],
      scopes: JSON.parse(client.scopes) as string[],
      isActive: client.isActive,
      createdAt: client.createdAt,
    }
  }
}

export const oauthService = new OAuthService()
