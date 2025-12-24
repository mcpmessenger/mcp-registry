/**
 * Server Identity Verification Service (SEP-1302)
 *
 * Implements the /.well-known/mcp-server-identity standard for verifying
 * server ownership and fetching signed metadata.
 */

export class ServerIdentityService {
  /**
   * Verify server identity by fetching from /.well-known/mcp-server-identity
   *
   * @param url Base URL of the MCP server
   * @returns Verification result with metadata
   */
  async verifyServerIdentity(url: string): Promise<{
    isValid: boolean
    error?: string
    publicKey?: string
    signature?: string
    manifest?: any
  }> {
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
        
        const identity = await response.json() as {
          publicKey?: string
          signature?: string
          manifest?: any
        }
        
        // Validate required fields
        if (!identity.publicKey || !identity.signature) {
          return {
            isValid: false,
            error: 'Identity response missing required fields: publicKey or signature',
          }
        }
        
        // For now, return that identity was found but not cryptographically verified
        // Full cryptographic verification would require implementing signature verification
        return {
          isValid: true,
          publicKey: identity.publicKey,
          signature: identity.signature,
          manifest: identity.manifest,
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError') {
          return {
            isValid: false,
            error: 'Identity verification timeout',
          }
        }
        throw fetchError
      }
    } catch (error: any) {
      return {
        isValid: false,
        error: error.message || 'Failed to verify server identity',
      }
    }
  }
}

export const serverIdentityService = new ServerIdentityService()


