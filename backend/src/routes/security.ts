/**
 * Security & Trust Scoring API
 * 
 * Endpoints for managing security scans and trust scores
 */

import { Router } from 'express'
import { trustScoringService } from '../services/trust-scoring.service'
import { authenticateUser } from '../middleware/auth.middleware'
import { prisma } from '../config/database'

const router = Router()

/**
 * POST /api/security/scan/:serverId
 * Trigger a security scan for a specific server
 */
router.post('/scan/:serverId', authenticateUser, async (req, res, next) => {
  try {
    const { serverId } = req.params
    
    console.log(`🔒 Starting security scan for server: ${serverId}`)
    
    // Run scan asynchronously (don't wait for completion)
    trustScoringService.scanServer(serverId).catch(error => {
      console.error(`❌ Security scan failed for ${serverId}:`, error)
    })
    
    res.json({
      success: true,
      message: 'Security scan started',
      serverId,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/security/scan-all
 * Trigger security scans for all active servers
 */
router.post('/scan-all', authenticateUser, async (req, res, next) => {
  try {
    console.log('🔒 Starting security scan for all servers...')
    
    // Run scans asynchronously
    trustScoringService.scanAllServers().catch(error => {
      console.error('❌ Security scan failed:', error)
    })
    
    res.json({
      success: true,
      message: 'Security scan started for all servers',
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/security/score/:serverId
 * Get security score for a specific server
 */
router.get('/score/:serverId', async (req, res, next) => {
  try {
    const { serverId } = req.params
    
    const server = await prisma.mcpServer.findUnique({
      where: { serverId },
      select: {
        serverId: true,
        name: true,
        securityScore: true,
        lastSecurityScan: true,
        securityScanResults: true,
      },
    })
    
    if (!server) {
      return res.status(404).json({
        error: 'Server not found',
        serverId,
      })
    }
    
    const scanResults = server.securityScanResults 
      ? JSON.parse(server.securityScanResults) 
      : null
    
    res.json({
      success: true,
      server: {
        serverId: server.serverId,
        name: server.name,
        securityScore: server.securityScore,
        lastSecurityScan: server.lastSecurityScan,
        scanResults,
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/security/scores
 * Get security scores for all servers
 */
router.get('/scores', async (req, res, next) => {
  try {
    const servers = await prisma.mcpServer.findMany({
      where: { isActive: true },
      select: {
        serverId: true,
        name: true,
        securityScore: true,
        lastSecurityScan: true,
        identityVerified: true,
      },
      orderBy: [
        { securityScore: 'desc' },
        { lastSecurityScan: 'desc' },
      ],
    })
    
    res.json({
      success: true,
      servers: servers.map(server => ({
        serverId: server.serverId,
        name: server.name,
        securityScore: server.securityScore,
        lastSecurityScan: server.lastSecurityScan,
        identityVerified: server.identityVerified,
      })),
      count: servers.length,
    })
  } catch (error) {
    next(error)
  }
})

export default router

