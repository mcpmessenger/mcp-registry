import { googleGeminiClient } from '../integrations/google-gemini'
import { googleVisionClient } from '../integrations/google-vision'
import { jobTrackerService } from './job-tracker.service'
import { assetRepository } from '../repositories/asset.repository'
import { designJobRepository } from '../repositories/design-job.repository'
import { kafkaProducerService } from './kafka-producer.service'

export interface GenerateSVGOptions {
  description: string
  style?: string
  colorPalette?: string[]
  size?: { width: number; height: number }
  serverId?: string
  userId?: string
  clientId?: string
}

export interface RefineDesignOptions {
  jobId: string
  instructions: string
}

export class McpToolsService {
  /**
   * Generate an SVG from a natural language description
   * 
   * This now uses the event-driven architecture:
   * 1. Creates a job
   * 2. Publishes DESIGN_REQUEST_RECEIVED event to Kafka
   * 3. Returns immediately (non-blocking)
   * 4. The Multimodal Worker processes the event asynchronously
   * 5. DESIGN_READY event is published when complete
   * 6. Frontend receives updates via WebSocket
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

    // Update initial progress
    await jobTrackerService.updateProgress(
      job.id,
      'PENDING',
      5,
      'Design request received, queued for processing...'
    )

    // Publish DESIGN_REQUEST_RECEIVED event to Kafka
    // This is the "central nervous system" - the event triggers async processing
    await kafkaProducerService.publishDesignRequestReceived(
      {
        jobId: job.id,
        description: options.description,
        style: options.style,
        colorPalette: options.colorPalette,
        size: options.size || { width: 512, height: 512 },
        serverId: options.serverId,
        userId: options.userId,
        clientId: options.clientId,
      },
      {
        userId: options.userId,
        clientId: options.clientId,
        correlationId: job.id,
      }
    )

    // Return immediately - the actual work happens asynchronously
    // Frontend will receive updates via WebSocket/SSE
    return {
      jobId: job.id,
      // svg and assetId will be available once DESIGN_READY event is processed
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
