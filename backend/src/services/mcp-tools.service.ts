import { googleGeminiClient } from '../integrations/google-gemini'
import { googleVisionClient } from '../integrations/google-vision'
import { jobTrackerService } from './job-tracker.service'
import { assetRepository } from '../repositories/asset.repository'
import { designJobRepository } from '../repositories/design-job.repository'

export interface GenerateSVGOptions {
  description: string
  style?: string
  colorPalette?: string[]
  size?: { width: number; height: number }
  serverId?: string
}

export interface RefineDesignOptions {
  jobId: string
  instructions: string
}

export class McpToolsService {
  /**
   * Generate an SVG from a natural language description
   */
  async generateSVG(options: GenerateSVGOptions): Promise<{
    jobId: string
    assetId?: string
    svg?: string
  }> {
    // Create job
    const job = await jobTrackerService.createJob({
      description: options.description,
      serverId: options.serverId,
    })

    try {
      // Update progress
      await jobTrackerService.updateProgress(
        job.id,
        'PROCESSING',
        10,
        'Analyzing design requirements...'
      )

      // Generate SVG using Gemini
      await jobTrackerService.updateProgress(
        job.id,
        'PROCESSING',
        30,
        'Generating SVG design...'
      )

      let svg: string
      try {
        svg = await googleGeminiClient.generateSVG({
          description: options.description,
          style: options.style,
          colorPalette: options.colorPalette,
          size: options.size || { width: 512, height: 512 },
        })
      } catch (error) {
        console.error('Error generating SVG:', error)
        throw new Error(`SVG generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }

      await jobTrackerService.updateProgress(
        job.id,
        'PROCESSING',
        70,
        'Validating and storing design...'
      )

      // Store asset
      const asset = await assetRepository.create({
        job: {
          connect: {
            id: job.id,
          },
        },
        assetType: 'svg',
        content: svg,
        version: 1,
        isLatest: true,
      })

      await jobTrackerService.updateProgress(
        job.id,
        'PROCESSING',
        90,
        'Finalizing...'
      )

      // Complete job
      await jobTrackerService.completeJob(job.id, 'SVG generated successfully')

      return {
        jobId: job.id,
        assetId: asset.id,
        svg,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      await jobTrackerService.failJob(job.id, errorMessage)
      throw error
    }
  }

  /**
   * Refine an existing design based on instructions
   */
  async refineDesign(options: RefineDesignOptions): Promise<{
    jobId: string
    assetId?: string
    svg?: string
  }> {
    // Get existing job and latest asset
    const job = await designJobRepository.findById(options.jobId)
    if (!job) {
      throw new Error(`Job ${options.jobId} not found`)
    }

    const latestAsset = await assetRepository.findLatestByJobId(options.jobId)
    if (!latestAsset || !latestAsset.content) {
      throw new Error(`No existing design found for job ${options.jobId}`)
    }

    // Create new job for refinement (or update existing)
    const refinementJob = await jobTrackerService.createJob({
      description: `${job.description} (refinement)`,
      refinementNotes: options.instructions,
      serverId: job.serverId || undefined,
    })

    try {
      await jobTrackerService.updateProgress(
        refinementJob.id,
        'PROCESSING',
        10,
        'Analyzing refinement instructions...'
      )

      await jobTrackerService.updateProgress(
        refinementJob.id,
        'PROCESSING',
        30,
        'Applying design changes...'
      )

      // Refine SVG using Gemini
      const refinedSvg = await googleGeminiClient.refineSVG(
        latestAsset.content,
        options.instructions
      )

      await jobTrackerService.updateProgress(
        refinementJob.id,
        'PROCESSING',
        70,
        'Validating refined design...'
      )

      // Store new asset version
      const nextVersion = (latestAsset.version || 1) + 1
      const asset = await assetRepository.create({
        job: {
          connect: {
            id: refinementJob.id,
          },
        },
        assetType: 'svg',
        content: refinedSvg,
        version: nextVersion,
        isLatest: true,
        metadata: JSON.stringify({
          parentJobId: job.id,
          parentAssetId: latestAsset.id,
          refinementInstructions: options.instructions,
        }),
      })

      await jobTrackerService.updateProgress(
        refinementJob.id,
        'PROCESSING',
        90,
        'Finalizing...'
      )

      await jobTrackerService.completeJob(refinementJob.id, 'Design refined successfully')

      return {
        jobId: refinementJob.id,
        assetId: asset.id,
        svg: refinedSvg,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      await jobTrackerService.failJob(refinementJob.id, errorMessage)
      throw error
    }
  }

  /**
   * Analyze an image using Google Vision API
   * Useful for understanding existing designs before refinement
   */
  async analyzeImage(imageSource: string | Buffer) {
    if (!googleVisionClient.isInitialized()) {
      throw new Error('Google Vision API is not initialized')
    }

    return googleVisionClient.analyzeImage(imageSource)
  }
}

export const mcpToolsService = new McpToolsService()
