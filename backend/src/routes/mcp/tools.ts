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

    // Try to use the service if it exists, otherwise use simple fallback
    try {
      // Dynamic import to handle missing services gracefully
      const mcpToolsModule = await Promise.resolve().then(() => {
        try {
          return require('../../services/mcp-tools.service')
        } catch {
          return null
        }
      })
      
      if (mcpToolsModule && mcpToolsModule.mcpToolsService) {
        // Use full service if available
        const result = await mcpToolsModule.mcpToolsService.generateSVG(validated)
        console.log('Generation result:', { jobId: result.jobId, hasAsset: !!result.assetId })
        
        return res.json({
          success: true,
          jobId: result.jobId,
          assetId: result.assetId,
          message: 'SVG generation started',
        })
      }
      
      // Fallback: Simple response without Kafka/job tracking
      // Generate a simple job ID and return immediately
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(7)}`
      
      console.log('Using fallback design generation (no Kafka/job tracking):', {
        jobId,
        description: validated.description,
        style: validated.style,
      })
      
      // Return success response with job ID
      // Note: In a full implementation, this would trigger async processing
      return res.json({
        success: true,
        jobId: jobId,
        message: 'Design generation request received. The design generation service is being set up. Please check back later or use the job ID to check status.',
        note: 'Full design generation with Kafka/job tracking is not yet configured. This is a placeholder response.',
      })
      
    } catch (serviceError) {
      // If service doesn't exist or fails, return a helpful error
      console.error('Service error:', serviceError)
      if (serviceError instanceof Error && (serviceError.message.includes('Cannot find module') || serviceError.message.includes('Cannot resolve'))) {
        // Fallback to simple response
        const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(7)}`
        return res.json({
          success: true,
          jobId: jobId,
          message: 'Design generation request received. Service setup in progress.',
          note: 'Full service stack not yet configured.',
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

