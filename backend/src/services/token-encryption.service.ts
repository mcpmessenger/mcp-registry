import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto'
import type { CipherGCM, DecipherGCM } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

export class TokenEncryptionService {
  private algorithm = 'aes-256-gcm'
  private keyLength = 32
  private ivLength = 16
  private saltLength = 16

  /**
   * Get encryption key from environment variable or derive from secret
   */
  private async getKey(): Promise<Buffer> {
    const secret = process.env.ENCRYPTION_SECRET || 'default-secret-change-in-production'
    const salt = Buffer.from(process.env.ENCRYPTION_SALT || 'default-salt', 'utf-8')
    return (await scryptAsync(secret, salt, this.keyLength)) as Buffer
  }

  /**
   * Encrypt tokens before storing
   */
  async encrypt(tokens: {
    accessToken: string
    refreshToken?: string
    idToken?: string
  }): Promise<string> {
    const key = await this.getKey()
    const iv = randomBytes(this.ivLength)
    const salt = randomBytes(this.saltLength)

    const cipher = createCipheriv(this.algorithm, key, iv) as CipherGCM
    
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(tokens), 'utf-8'),
      cipher.final(),
    ])

    const authTag = cipher.getAuthTag()

    // Combine salt + iv + authTag + encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      authTag,
      encrypted,
    ])

    return combined.toString('base64')
  }

  /**
   * Decrypt tokens after retrieval
   */
  async decrypt(encryptedData: string): Promise<{
    accessToken: string
    refreshToken?: string
    idToken?: string
  }> {
    const combined = Buffer.from(encryptedData, 'base64')
    
    const salt = combined.subarray(0, this.saltLength)
    const iv = combined.subarray(this.saltLength, this.saltLength + this.ivLength)
    const authTag = combined.subarray(
      this.saltLength + this.ivLength,
      this.saltLength + this.ivLength + 16
    )
    const encrypted = combined.subarray(this.saltLength + this.ivLength + 16)

    const key = await this.getKey()
    const decipher = createDecipheriv(this.algorithm, key, iv) as DecipherGCM
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ])

    return JSON.parse(decrypted.toString('utf-8'))
  }
}

export const tokenEncryptionService = new TokenEncryptionService()
