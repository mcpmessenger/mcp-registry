import type { DesignRequestReceivedPayload } from '../types/kafka-events'
import { googleGeminiClient } from '../integrations/google-gemini'
import { jobTrackerService } from './job-tracker.service'
import { assetRepository } from '../repositories/asset.repository'
import { kafkaProducerService } from './kafka-producer.service'

/**
 * Multimodal Worker Service
 * 
 * This service processes DESIGN_REQUEST_RECEIVED events from Kafka.
 * It implements the worker pattern: picks up events, processes them,
 * and publishes completion events back to Kafka.
 * 
 * This runs as a background consumer of the design-requests topic.
 */
export class MultimodalWorkerService {
  /**
   * Process a design request
   * Called by the Kafka consumer when a DESIGN_REQUEST_RECEIVED event is received
   */
  async processDesignRequest(
    payload: DesignRequestReceivedPayload,
    metadata?: { userId?: string; clientId?: string; correlationId?: string }
  ): Promise<void> {
    const { jobId, description, style, colorPalette, size } = payload

    try {
      // Update job status to PROCESSING
      await jobTrackerService.updateProgress(
        jobId,
        'PROCESSING',
        10,
        'Analyzing design requirements...'
      )

      // Generate SVG using Gemini (the actual generative work)
      await jobTrackerService.updateProgress(
        jobId,
        'PROCESSING',
        30,
        'Generating SVG design with AI...'
      )

      let svg: string
      try {
        svg = await googleGeminiClient.generateSVG({
          description,
          style,
          colorPalette,
          size: size || { width: 512, height: 512 },
        })
      } catch (error) {
        console.error('Error generating SVG:', error)
        throw new Error(`SVG generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }

      await jobTrackerService.updateProgress(
        jobId,
        'PROCESSING',
        70,
        'Validating and storing design...'
      )

      // Store asset
      const asset = await assetRepository.create({
        job: {
          connect: {
            id: jobId,
          },
        },
        assetType: 'svg',
        content: svg,
        version: 1,
        isLatest: true,
      })

      await jobTrackerService.updateProgress(
        jobId,
        'PROCESSING',
        90,
        'Finalizing...'
      )

      // Publish DESIGN_READY event to Kafka
      // This will be consumed by the API Gateway and pushed to frontend via WebSocket
      await kafkaProducerService.publishDesignReady(
        {
          jobId,
          assetId: asset.id,
          svg,
          assetType: 'svg',
        },
        metadata
      )

      console.log(`✅ Design generated successfully for job ${jobId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

      // Publish DESIGN_FAILED event to Kafka
      await kafkaProducerService.publishDesignFailed(
        {
          jobId,
          errorMessage,
          retryable: true,
        },
        metadata
      )

      console.error(`❌ Design generation failed for job ${jobId}:`, errorMessage)
      throw error
    }
  }
}

export const multimodalWorkerService = new MultimodalWorkerService()
