import { Router } from 'express'
import { z } from 'zod'
import { mcpToolsService } from '../../services/mcp-tools.service'
import { jobTrackerService } from '../../services/job-tracker.service'

const router = Router()

// Validation schemas
const generateSVGSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  style: z.string().optional(),
  colorPalette: z.array(z.string()).optional(),
  size: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
  serverId: z.string().optional(),
})

const refineDesignSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
  instructions: z.string().min(1, 'Instructions are required'),
})

/**
 * POST /api/mcp/tools/generate
 * Generate an SVG from a natural language description
 */
router.post('/generate', async (req, res, next) => {
  try {
    console.log('Received generate request:', req.body)
    const validated = generateSVGSchema.parse(req.body)
    console.log('Validated request:', validated)
    
    const result = await mcpToolsService.generateSVG(validated)
    console.log('Generation result:', { jobId: result.jobId, hasAsset: !!result.assetId })

    res.json({
      success: true,
      jobId: result.jobId,
      assetId: result.assetId,
      message: 'SVG generation started',
    })
  } catch (error) {
    console.error('Error in /generate endpoint:', error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      })
    }
    next(error)
  }
})

/**
 * POST /api/mcp/tools/refine
 * Refine an existing design based on instructions
 */
router.post('/refine', async (req, res, next) => {
  try {
    const validated = refineDesignSchema.parse(req.body)
    const result = await mcpToolsService.refineDesign(validated)

    res.json({
      success: true,
      jobId: result.jobId,
      assetId: result.assetId,
      message: 'Design refinement started',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      })
    }
    next(error)
  }
})

/**
 * GET /api/mcp/tools/job/:jobId
 * Get job status and result
 */
router.get('/job/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params
    const job = await jobTrackerService.getJob(jobId)

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      })
    }

    // Get latest asset if available
    const latestAsset = job.assets.find((a) => a.isLatest) || job.assets[0]

    res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        progressMessage: job.progressMessage,
        errorMessage: job.errorMessage,
        description: job.description,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
      },
      asset: latestAsset
        ? {
            id: latestAsset.id,
            assetType: latestAsset.assetType,
            content: latestAsset.content,
            url: latestAsset.url,
            version: latestAsset.version,
            createdAt: latestAsset.createdAt,
          }
        : null,
    })
  } catch (error) {
    next(error)
  }
})

export default router
