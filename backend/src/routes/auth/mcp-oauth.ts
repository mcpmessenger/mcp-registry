import { Router } from 'express'
import { mcpOAuthService } from '../../services/mcp-oauth.service'

const router = Router()

/**
 * GET /api/auth/mcp/:serverId/authorize
 * Initiate OAuth flow for an MCP server
 */
router.get('/:serverId/authorize', async (req, res) => {
  try {
    const { serverId } = req.params
    const state = req.query.state as string | undefined

    const authUrl = await mcpOAuthService.getAuthorizationUrl(serverId, state)
    res.redirect(authUrl)
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate OAuth',
    })
  }
})

/**
 * GET /api/auth/mcp/:serverId/callback
 * OAuth callback handler
 */
router.get('/:serverId/callback', async (req, res) => {
  try {
    const { serverId } = req.params
    const { code, state, error } = req.query

    if (error) {
      return res.status(400).json({
        success: false,
        error: `OAuth error: ${error}`,
      })
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Missing authorization code',
      })
    }

    await mcpOAuthService.exchangeCode(serverId, code as string)

    res.json({
      success: true,
      message: 'OAuth authorization successful',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'OAuth callback failed',
    })
  }
})

export default router
