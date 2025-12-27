/**
 * Orchestrator Query Route
 * 
 * Entry point for the Kafka-based orchestrator.
 * Publishes user requests to Kafka and returns results.
 */

import { Router, Request, Response } from 'express'
import { publishUserRequest } from '../../services/orchestrator/ingress'
import { waitForResult } from '../../services/orchestrator/result-consumer'
import type { OrchestratorResultEvent } from '../../services/orchestrator/events'

const router = Router()

/**
 * POST /api/orchestrator/query
 * Submit a query to the orchestrator
 */
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { query, sessionId, contextSnapshot } = req.body
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Query is required and must be a string',
      })
    }
    
    // Publish to Kafka
    const requestId = await publishUserRequest(query, sessionId, contextSnapshot)
    console.log(`[Orchestrator Query] Published request ${requestId}, waiting for result...`)
    
    // Use shared result consumer (no rebalance delay!)
    const timeout = 20000 // 20 seconds
    let result: OrchestratorResultEvent
    
    try {
      result = await waitForResult(requestId, timeout)
      
      if (result.status === 'failed' || result.error) {
        return res.status(500).json({
          error: 'Orchestration failed',
          message: result.error || 'Unknown error',
          requestId,
        })
      }
      
      res.json({
        success: true,
        requestId,
        result: result.result,
        tool: result.tool,
        status: result.status,
      })
    } catch (error) {
      res.status(504).json({
        error: 'Timeout',
        message: error instanceof Error ? error.message : 'Request timed out',
        requestId,
      })
    }
  } catch (error) {
    console.error('[Orchestrator Query] Error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

export default router

