// Dynamic imports to handle missing integrations gracefully
let googleGeminiClient: any
let googleVisionClient: any

try {
  const geminiModule = require('../integrations/google-gemini')
  googleGeminiClient = geminiModule.googleGeminiClient
} catch {
  // Integration not available
  googleGeminiClient = null
}

try {
  const visionModule = require('../integrations/google-vision')
  googleVisionClient = visionModule.googleVisionClient
} catch {
  // Integration not available
  googleVisionClient = null
}

export interface DocumentAnalysisOptions {
  file: Buffer
  fileName: string
  mimeType: string
  query?: string
}

export interface DocumentAnalysisResult {
  text?: string
  summary?: string
  insights?: string[]
  labels?: Array<{ description: string; score: number }>
  error?: string
}

export class DocumentAnalysisService {
  /**
   * Analyze a document (PDF, image, etc.) using Gemini Vision API
   */
  async analyzeDocument(options: DocumentAnalysisOptions): Promise<DocumentAnalysisResult> {
    const { file, fileName, mimeType, query } = options

    try {
      // For images, use Gemini Vision API directly
      if (mimeType.startsWith('image/')) {
        return await this.analyzeImage(file, fileName, query)
      }

      // For PDFs, we need to convert to images first
      // For now, we'll use Gemini's PDF support if available, or extract text
      if (mimeType === 'application/pdf') {
        return await this.analyzePDF(file, fileName, query)
      }

      // For text files, read and analyze
      if (mimeType.startsWith('text/')) {
        return await this.analyzeText(file, fileName, query)
      }

      throw new Error(`Unsupported file type: ${mimeType}`)
    } catch (error) {
      console.error('Document analysis error:', error)
      return {
        error: error instanceof Error ? error.message : 'Failed to analyze document',
      }
    }
  }

  /**
   * Analyze an image using Gemini Vision API
   */
  private async analyzeImage(
    imageBuffer: Buffer,
    fileName: string,
    query?: string
  ): Promise<DocumentAnalysisResult> {
    try {
      // Convert buffer to base64 for Gemini API
      const base64Image = imageBuffer.toString('base64')
      const mimeType = fileName.endsWith('.png') ? 'image/png' : 
                      fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') ? 'image/jpeg' :
                      'image/png'

      // Build prompt based on query or default analysis
      const prompt = query 
        ? `Analyze this image and answer: ${query}\n\nProvide a detailed analysis.`
        : `Analyze this image and provide:
1. A detailed description of what you see
2. Key insights and observations
3. Any text visible in the image
4. Important details or patterns

Be thorough and specific.`

      // Use Gemini Vision API
      if (!googleGeminiClient) {
        throw new Error('Google Gemini integration is not available')
      }
      const analysis = await googleGeminiClient.analyzeImageWithVision({
        image: {
          data: base64Image,
          mimeType: mimeType,
        },
        prompt: prompt,
      })

      // Format the response
      const fullText = analysis.text || ''
      const summary = analysis.summary || fullText.substring(0, 300) + '...'
      const insights = analysis.insights || []

      return {
        text: fullText,
        summary: summary,
        insights: insights.length > 0 ? insights : [fullText],
      }
    } catch (error) {
      console.error('Image analysis error:', error)
      throw new Error(`Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Analyze a PDF document
   */
  private async analyzePDF(
    pdfBuffer: Buffer,
    fileName: string,
    query?: string
  ): Promise<DocumentAnalysisResult> {
    try {
      // Convert PDF to base64
      const base64PDF = pdfBuffer.toString('base64')

      // Build prompt
      const prompt = query
        ? `Analyze this PDF document and answer: ${query}\n\nProvide a comprehensive analysis based on the document content.`
        : `Analyze this PDF document and provide:
1. A summary of the main content
2. Key topics and themes
3. Important insights and findings
4. Any notable patterns or conclusions

Be thorough and extract all relevant information.`

      // Use Gemini Vision API (Gemini can process PDFs as images)
      // Note: Gemini Vision API may not support PDFs directly, so we might need to convert pages to images
      // For now, try as-is - if it fails, we'll need PDF-to-image conversion
      if (!googleGeminiClient) {
        throw new Error('Google Gemini integration is not available')
      }
      try {
        const analysis = await googleGeminiClient.analyzeImageWithVision({
          image: {
            data: base64PDF,
            mimeType: 'application/pdf',
          },
          prompt: prompt,
        })

        const fullText = analysis.text || ''
        const summary = analysis.summary || fullText.substring(0, 300) + '...'
        const insights = analysis.insights || []

        return {
          text: fullText,
          summary: summary,
          insights: insights.length > 0 ? insights : [fullText],
        }
      } catch (error) {
        // If PDF direct processing fails, return error message
        throw new Error(`PDF analysis not yet supported. Please convert PDF to images first. Error: ${error instanceof Error ? error.message : 'Unknown'}`)
      }
    } catch (error) {
      console.error('PDF analysis error:', error)
      throw new Error(`Failed to analyze PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Analyze a text file
   */
  private async analyzeText(
    textBuffer: Buffer,
    fileName: string,
    query?: string
  ): Promise<DocumentAnalysisResult> {
    try {
      const textContent = textBuffer.toString('utf-8')

      // Build prompt
      const prompt = query
        ? `Analyze this text document and answer: ${query}\n\nDocument content:\n${textContent}`
        : `Analyze this text document and provide:
1. A summary of the main content
2. Key topics and themes
3. Important insights and findings
4. Any notable patterns or conclusions

Document content:
${textContent}`

      // Use Gemini text model
      if (!googleGeminiClient) {
        throw new Error('Google Gemini integration is not available')
      }
      const analysis = await googleGeminiClient.generateText(prompt)

      return {
        text: textContent,
        summary: analysis,
        insights: analysis.split('\n').filter((line: string) => line.trim().length > 0),
      }
    } catch (error) {
      console.error('Text analysis error:', error)
      throw new Error(`Failed to analyze text: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

export const documentAnalysisService = new DocumentAnalysisService()







