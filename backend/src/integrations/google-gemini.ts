import { GoogleGenerativeAI } from '@google/generative-ai'
import { env } from '../config/env'

export interface SVGGenerationOptions {
  description: string
  style?: string
  colorPalette?: string[]
  size?: { width: number; height: number }
  refineInstructions?: string
}

export class GoogleGeminiClient {
  private genAI: GoogleGenerativeAI | null = null
  private model: any = null

  constructor() {
    if (env.google.geminiApiKey) {
      console.log('Initializing Google Gemini client...')
      this.genAI = new GoogleGenerativeAI(env.google.geminiApiKey)
      // Use gemini-pro (original stable model that works with v1beta API)
      // Note: Newer models like gemini-1.5-flash and gemini-2.0-flash may not be available
      // in v1beta API. Use gemini-pro for compatibility.
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' })
      console.log('Google Gemini client initialized successfully with model: gemini-pro')
    } else {
      console.warn('Google Gemini API key not found. Set GOOGLE_GEMINI_API_KEY in .env')
    }
  }

  /**
   * Generate SVG code from a natural language description
   */
  async generateSVG(options: SVGGenerationOptions): Promise<string> {
    if (!this.model) {
      throw new Error('Google Gemini API client not initialized. Set GOOGLE_GEMINI_API_KEY')
    }

    try {
      const prompt = this.buildSVGPrompt(options)
      console.log('Generating SVG with prompt length:', prompt.length)
      
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      console.log('Received response from Gemini, length:', text.length)

      // Extract SVG from response (may be wrapped in markdown code blocks)
      const svgMatch = text.match(/```(?:svg|xml)?\s*([\s\S]*?)```/i) || text.match(/<svg[\s\S]*?<\/svg>/i)
      
      if (svgMatch) {
        return svgMatch[1] || svgMatch[0]
      }

      // If no SVG found, try to extract any XML-like content
      const xmlMatch = text.match(/<[\s\S]*?>/)
      if (xmlMatch) {
        return text
      }

      // Fallback: return the full response and let the caller handle it
      return text
    } catch (error: any) {
      console.error('Google Gemini API error:', error)
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        status: error?.status,
        statusText: error?.statusText,
        response: error?.response,
      })
      throw new Error(`Failed to generate SVG: ${error?.message || error?.toString() || 'Unknown error'}`)
    }
  }

  /**
   * Refine an existing SVG based on instructions
   */
  async refineSVG(existingSVG: string, instructions: string): Promise<string> {
    if (!this.model) {
      throw new Error('Google Gemini API client not initialized. Set GOOGLE_GEMINI_API_KEY')
    }

    try {
      const prompt = `You are an expert at working with SVG graphics. Refine the following SVG based on these instructions: "${instructions}"

Current SVG:
${existingSVG}

Please provide the refined SVG code. Only return the SVG code, no explanations.`

      const result = await this.model.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      // Extract SVG from response
      const svgMatch = text.match(/```(?:svg|xml)?\s*([\s\S]*?)```/i) || text.match(/<svg[\s\S]*?<\/svg>/i)
      
      if (svgMatch) {
        return svgMatch[1] || svgMatch[0]
      }

      return text
    } catch (error) {
      console.error('Google Gemini API error:', error)
      throw new Error(`Failed to refine SVG: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Build a prompt for SVG generation
   */
  private buildSVGPrompt(options: SVGGenerationOptions): string {
    let prompt = `You are an expert at creating SVG graphics. Generate a clean, professional SVG based on this description: "${options.description}"

Requirements:
- Output valid, well-formed SVG code
- Use vector graphics (paths, shapes, text)
- Keep it simple and scalable
- Ensure the SVG is self-contained (no external dependencies)
`

    if (options.style) {
      prompt += `- Style: ${options.style}\n`
    }

    if (options.colorPalette && options.colorPalette.length > 0) {
      prompt += `- Color palette: ${options.colorPalette.join(', ')}\n`
    }

    if (options.size) {
      prompt += `- Size: ${options.size.width}x${options.size.height} pixels\n`
    } else {
      prompt += `- Size: 512x512 pixels (default)\n`
    }

    if (options.refineInstructions) {
      prompt += `- Additional instructions: ${options.refineInstructions}\n`
    }

    prompt += `\nPlease provide only the SVG code, starting with <svg> and ending with </svg>. No explanations or markdown formatting.`

    return prompt
  }

  /**
   * Check if the client is initialized
   */
  isInitialized(): boolean {
    return this.model !== null
  }
}

export const googleGeminiClient = new GoogleGeminiClient()
