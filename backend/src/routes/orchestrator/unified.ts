/**
 * Unified Orchestrator Route
 * 
 * API endpoint for the Six Pillars orchestration system
 */

import { Router, Request, Response } from 'express'
import { getUnifiedOrchestrator } from '../../services/orchestrator/unified-orchestrator.service'

const router = Router()

/**
 * POST /api/orchestrator/unified/plan
 * Plan a workflow using all six pillars
 */
router.post('/plan', async (req: Request, res: Response) => {
  try {
    const { query, context } = req.body
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Query is required and must be a string',
      })
    }
    
    const orchestrator = getUnifiedOrchestrator()
    const plan = await orchestrator.planWorkflow(query, context)
    
    res.json({
      success: true,
      plan,
    })
  } catch (error) {
    console.error('[Unified Orchestrator] Error planning workflow:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * POST /api/orchestrator/unified/execute
 * Execute a workflow plan
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { plan, context } = req.body
    
    if (!plan || !plan.steps || !Array.isArray(plan.steps)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Plan with steps array is required',
      })
    }
    
    const orchestrator = getUnifiedOrchestrator()
    const result = await orchestrator.executeWorkflow(plan, context)
    
    res.json({
      success: result.success,
      result,
    })
  } catch (error) {
    console.error('[Unified Orchestrator] Error executing workflow:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * POST /api/orchestrator/unified/query
 * Plan and execute in one call
 */
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { query, context } = req.body
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Query is required and must be a string',
      })
    }
    
    const orchestrator = getUnifiedOrchestrator()
    
    // Plan workflow
    const plan = await orchestrator.planWorkflow(query, context)
    
    if (plan.steps.length === 0) {
      return res.status(404).json({
        error: 'No matching tools',
        message: plan.reasoning,
      })
    }
    
    // Execute workflow
    const result = await orchestrator.executeWorkflow(plan, context)
    
    res.json({
      success: result.success,
      plan,
      result,
    })
  } catch (error) {
    console.error('[Unified Orchestrator] Error processing query:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

export default router
