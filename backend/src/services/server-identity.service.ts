/**
 * Server Identity Verification Service (SEP-1302)
 * 
 * Implements the /.well-known/mcp-server-identity standard for verifying
 * server ownership and fetching signed metadata.
 */

export interface ServerIdentity {
  publicKey: string
  signature: string
  manifest: Record<string, unknown>
  serverId: string
  name?: string
  version?: string
}

export interface IdentityVerificationResult {
  isValid: boolean
  metadata?: Record<string, unknown>
  publicKey?: string
  signature?: string
  error?: string
}

export class ServerIdentityService {
  /**
   * Verify server identity by fetching from /.well-known/mcp-server-identity
   * 
   * @param url Base URL of the MCP server
   * @returns Verification result with metadata
   */
  async verifyServerIdentity(url: string): Promise<IdentityVerificationResult> {
    try {
      // Construct identity endpoint URL
      const baseUrl = new URL(url)
      const identityUrl = new URL('/.well-known/mcp-server-identity', baseUrl.origin)
      
      console.log(`🔍 Verifying server identity at: ${identityUrl.toString()}`)
      
      // Fetch identity endpoint with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      try {
        const response = await fetch(identityUrl.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          return {
            isValid: false,
            error: `Identity endpoint returned ${response.status}: ${response.statusText}`,
          }
        }
        
        const identity: ServerIdentity = await response.json()
        
        // Validate required fields
        if (!identity.publicKey || !identity.signature) {
          return {
            isValid: false,
            error: 'Identity response missing required fields: publicKey or signature',
          }
        }
        
        // Verify cryptographic signature
        const isValid = await this.verifySignature(
          identity.publicKey,
          identity.signature,
          identity.manifest || {}
        )
        
        return {
          isValid,
          metadata: identity.manifest,
          publicKey: identity.publicKey,
          signature: identity.signature,
          error: isValid ? undefined : 'Signature verification failed',
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        
        if (fetchError.name === 'AbortError') {
          return {
            isValid: false,
            error: 'Identity endpoint request timed out',
          }
        }
        
        throw fetchError
      }
    } catch (error: any) {
      console.error('❌ Error verifying server identity:', error)
      return {
        isValid: false,
        error: error.message || 'Failed to verify server identity',
      }
    }
  }
  
  /**
   * Verify cryptographic signature
   * 
   * This is a placeholder implementation. In production, you would:
   * 1. Use a proper cryptographic library (e.g., node-forge, crypto)
   * 2. Verify the signature against the public key
   * 3. Check the signed payload matches the manifest
   * 
   * @param publicKey Public key in PEM format
   * @param signature Base64-encoded signature
   * @param manifest Manifest data that was signed
   * @returns Whether the signature is valid
   */
  private async verifySignature(
    publicKey: string,
    signature: string,
    manifest: Record<string, unknown>
  ): Promise<boolean> {
    try {
      // TODO: Implement proper cryptographic signature verification
      // For now, we'll do basic validation:
      // 1. Check that publicKey and signature are present and non-empty
      // 2. In production, use Web Crypto API or node-forge to verify
      
      if (!publicKey || !signature) {
        return false
      }
      
      // Basic format validation
      if (typeof publicKey !== 'string' || typeof signature !== 'string') {
        return false
      }
      
      // In a real implementation, you would:
      // 1. Parse the public key (PEM format)
      // 2. Create a hash of the manifest
      // 3. Verify the signature against the hash using the public key
      
      // For now, we'll accept any well-formed response as valid
      // This allows the system to work while proper crypto is implemented
      console.log('⚠️  Signature verification is a placeholder - accepting as valid for now')
      console.log('   Public key length:', publicKey.length)
      console.log('   Signature length:', signature.length)
      
      return true
    } catch (error) {
      console.error('❌ Error in signature verification:', error)
      return false
    }
  }
  
  /**
   * Extract base URL from various input formats
   */
  extractBaseUrl(input: string): string | null {
    try {
      // If it's already a full URL, use it
      if (input.startsWith('http://') || input.startsWith('https://')) {
        return input
      }
      
      // If it's a serverId with endpoint in metadata, we need to look it up
      // For now, assume input is a URL
      return input
    } catch (error) {
      console.error('❌ Error extracting base URL:', error)
      return null
    }
  }
}

export const serverIdentityService = new ServerIdentityService()

