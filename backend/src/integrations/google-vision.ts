import { ImageAnnotatorClient } from '@google-cloud/vision'
import { env } from '../config/env'

export interface VisionAnalysisResult {
  labels?: Array<{ description: string; score: number }>
  text?: string
  colors?: Array<{ color: { r: number; g: number; b: number }; score: number }>
  logos?: Array<{ description: string; score: number }>
}

export class GoogleVisionClient {
  private client: ImageAnnotatorClient | null = null

  constructor() {
    // Try Vision API key first, then fall back to Gemini key (same key can work for both)
    const apiKey = env.google.visionApiKey || env.google.geminiApiKey
    
    if (apiKey) {
      // Initialize with API key (works if key has both APIs enabled)
      this.client = new ImageAnnotatorClient({
        apiKey: apiKey,
      })
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Initialize with service account credentials
      this.client = new ImageAnnotatorClient()
    }
  }

  /**
   * Analyze an image from a URL or base64 data
   */
  async analyzeImage(imageSource: string | Buffer): Promise<VisionAnalysisResult> {
    if (!this.client) {
      throw new Error('Google Vision API client not initialized. Set GOOGLE_VISION_API_KEY or GOOGLE_APPLICATION_CREDENTIALS')
    }

    try {
      // Google Vision API expects image in request format
      const imageRequest = typeof imageSource === 'string' 
        ? { image: { source: { imageUri: imageSource } } }
        : { image: { content: imageSource } }

      // Perform multiple detections
      const [labelResult, textResult, colorResult, logoResult] = await Promise.all([
        this.client.labelDetection(imageRequest),
        this.client.textDetection(imageRequest),
        this.client.imageProperties(imageRequest),
        this.client.logoDetection(imageRequest),
      ])

      const result: VisionAnalysisResult = {}

      // Extract labels
      if (labelResult[0]?.labelAnnotations) {
        result.labels = labelResult[0].labelAnnotations.map((label) => ({
          description: label.description || '',
          score: label.score || 0,
        }))
      }

      // Extract text
      if (textResult[0]?.textAnnotations?.[0]?.description) {
        result.text = textResult[0].textAnnotations[0].description
      }

      // Extract dominant colors
      if (colorResult[0]?.imagePropertiesAnnotation?.dominantColors?.colors) {
        result.colors = colorResult[0].imagePropertiesAnnotation.dominantColors.colors.map((color) => ({
          color: {
            r: color.color?.red || 0,
            g: color.color?.green || 0,
            b: color.color?.blue || 0,
          },
          score: color.score || 0,
        }))
      }

      // Extract logos
      if (logoResult[0]?.logoAnnotations) {
        result.logos = logoResult[0].logoAnnotations.map((logo) => ({
          description: logo.description || '',
          score: logo.score || 0,
        }))
      }

      return result
    } catch (error) {
      console.error('Google Vision API error:', error)
      throw new Error(`Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Analyze an image from base64 string
   */
  async analyzeImageFromBase64(base64Data: string): Promise<VisionAnalysisResult> {
    const buffer = Buffer.from(base64Data, 'base64')
    return this.analyzeImage(buffer)
  }

  /**
   * Check if the client is initialized
   */
  isInitialized(): boolean {
    return this.client !== null
  }
}

export const googleVisionClient = new GoogleVisionClient()
