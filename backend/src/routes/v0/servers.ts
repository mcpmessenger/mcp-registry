import { Router } from 'express'
import { registryService } from '../../services/registry.service'

const router = Router()

/**
 * GET /v0/servers
 * Returns a JSON list of available design-capable MCP servers
 * This is the "App Store" entry point for the frontend
 */
router.get('/servers', async (req, res, next) => {
  try {
    const servers = await registryService.getServers()
    res.json(servers)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /v0/servers/:serverId
 * Get a specific server by ID
 */
router.get('/servers/:serverId', async (req, res, next) => {
  try {
    const { serverId } = req.params
    const server = await registryService.getServerById(serverId)

    if (!server) {
      return res.status(404).json({
        error: 'Server not found',
        serverId,
      })
    }

    res.json(server)
  } catch (error) {
    next(error)
  }
})

export default router
