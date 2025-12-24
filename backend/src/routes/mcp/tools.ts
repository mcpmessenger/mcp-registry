import { Router } from 'express'
import { z } from 'zod'

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

    // Try to use the service if it exists
    try {
      // Dynamic import to handle missing services gracefully
      // Using require to avoid TypeScript module resolution errors
      const mcpToolsModule = await Promise.resolve().then(() => {
        try {
          return require('../../services/mcp-tools.service')
        } catch {
          return null
        }
      })
      if (!mcpToolsModule || !mcpToolsModule.mcpToolsService) {
        return res.status(503).json({
          success: false,
          error: 'Design generation service is not available',
          message: 'The design generation service is not properly configured. Please check backend deployment.',
          details: 'Missing mcp-tools.service or dependencies',
        })
      }
      
      const result = await mcpToolsModule.mcpToolsService.generateSVG(validated)
      console.log('Generation result:', { jobId: result.jobId, hasAsset: !!result.assetId })
      
      res.json({
        success: true,
        jobId: result.jobId,
        assetId: result.assetId,
        message: 'SVG generation started',
      })
    } catch (serviceError) {
      // If service doesn't exist or fails, return a helpful error
      console.error('Service error:', serviceError)
      if (serviceError instanceof Error && (serviceError.message.includes('Cannot find module') || serviceError.message.includes('Cannot resolve'))) {
        return res.status(503).json({
          success: false,
          error: 'Design generation service is not available',
          message: 'The design generation service is not properly configured. Please check backend deployment.',
          details: 'Missing mcp-tools.service or dependencies',
        })
      }
      throw serviceError
    }
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
      
      try {
        const mcpToolsModule = await Promise.resolve().then(() => {
          try {
            return require('../../services/mcp-tools.service')
          } catch {
            return null
          }
        })
        if (!mcpToolsModule || !mcpToolsModule.mcpToolsService) {
          return res.status(503).json({
            success: false,
            error: 'Design refinement service is not available',
            message: 'The design refinement service is not properly configured.',
          })
        }
        
        const result = await mcpToolsModule.mcpToolsService.refineDesign(validated)
        
        res.json({
          success: true,
          jobId: result.jobId,
          assetId: result.assetId,
          message: 'Design refinement started',
        })
      } catch (serviceError) {
        console.error('Service error:', serviceError)
        if (serviceError instanceof Error && (serviceError.message.includes('Cannot find module') || serviceError.message.includes('Cannot resolve'))) {
          return res.status(503).json({
            success: false,
            error: 'Design refinement service is not available',
            message: 'The design refinement service is not properly configured.',
          })
        }
        throw serviceError
      }
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
      
      try {
        const jobTrackerModule = await Promise.resolve().then(() => {
          try {
            return require('../../services/job-tracker.service')
          } catch {
            return null
          }
        })
        if (!jobTrackerModule || !jobTrackerModule.jobTrackerService) {
          return res.status(503).json({
            success: false,
            error: 'Job tracking service is not available',
            message: 'The job tracking service is not properly configured.',
          })
        }
        
        const job = await jobTrackerModule.jobTrackerService.getJob(jobId)
        
        if (!job) {
          return res.status(404).json({
            success: false,
            error: 'Job not found',
          })
        }

        // Get latest asset if available
        const latestAsset = (job as any).assets?.find((a: any) => a.isLatest) || (job as any).assets?.[0]
        
        res.json({
          success: true,
          job: {
            id: (job as any).id,
            status: (job as any).status,
            progress: (job as any).progress,
            progressMessage: (job as any).progressMessage,
            errorMessage: (job as any).errorMessage,
            description: (job as any).description,
            createdAt: (job as any).createdAt,
            updatedAt: (job as any).updatedAt,
            completedAt: (job as any).completedAt,
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
      } catch (serviceError) {
        console.error('Service error:', serviceError)
        if (serviceError instanceof Error && (serviceError.message.includes('Cannot find module') || serviceError.message.includes('Cannot resolve'))) {
          return res.status(503).json({
            success: false,
            error: 'Job tracking service is not available',
            message: 'The job tracking service is not properly configured.',
          })
        }
        throw serviceError
      }
  } catch (error) {
    next(error)
  }
})

export default router

