/**
 * Orchestrator Jobs Route
 *
 * Async wrapper around the Kafka-based orchestrator pipeline.
 */

import { Router, type Request, type Response } from 'express'
import { orchestratorJobsService } from '../../services/orchestrator/jobs.service'

const router = Router()

/**
 * POST /api/orchestrator/jobs
 * Create a job and enqueue it to Kafka.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { query, sessionId, contextSnapshot } = req.body ?? {}

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'query is required and must be a string',
      })
    }

    const job = await orchestratorJobsService.createJob({ query, sessionId, contextSnapshot })

    return res.status(202).json({
      success: true,
      jobId: job.id,
      requestId: job.requestId,
      status: job.status,
      createdAt: job.createdAt,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to create job',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

/**
 * GET /api/orchestrator/jobs/:jobId
 * Fetch the latest job status/result.
 */
router.get('/:jobId', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId
    const job = await orchestratorJobsService.getJob(jobId)

    if (!job) {
      return res.status(404).json({
        error: 'Not found',
        message: `Job ${jobId} not found`,
      })
    }

    return res.json({
      success: true,
      job: {
        id: job.id,
        requestId: job.requestId,
        query: job.query,
        sessionId: job.sessionId,
        status: job.status,
        resultJson: job.resultJson,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
      },
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to fetch job',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

/**
 * POST /api/orchestrator/jobs/:jobId/cancel
 * Best-effort cancel: marks cancelled and ignores late results.
 */
router.post('/:jobId/cancel', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId
    const updated = await orchestratorJobsService.cancelJob(jobId)

    return res.json({
      success: true,
      jobId: updated.id,
      status: updated.status,
      completedAt: updated.completedAt,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to cancel job',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

export default router

