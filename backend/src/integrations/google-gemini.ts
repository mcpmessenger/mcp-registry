import { env } from '../config/env'

export interface SVGGenerationOptions {
  description: string
  style?: string
  colorPalette?: string[]
  size?: { width: number; height: number }
  refineInstructions?: string
}

/**
 * Google Gemini Client with multiple fallback strategies:
 * 1. Try @google/genai SDK (new SDK)
 * 2. Fallback to REST API v1 endpoint (bypasses SDK issues)
 * 3. Provider fallback mechanism for resilience
 */
export class GoogleGeminiClient {
  private apiKey: string | null = null
  private modelName: string = 'gemini-2.5-flash'
  private useSDK: boolean = false
  private sdkModel: any = null

  constructor() {
    if (env.google.geminiApiKey) {
      this.apiKey = env.google.geminiApiKey
      // Use Gemini 2.5 models (1.5 models have been retired)
      // gemini-2.5-flash is optimized for speed and cost-effectiveness
      // Alternative: gemini-2.5-pro for more complex tasks
      this.modelName = env.google.geminiModelName || 'gemini-2.5-flash'
      
      // Try to initialize SDK (optional, will fallback to REST if fails)
      this.initializeSDK()
      console.log(`Google Gemini client initialized (SDK: ${this.useSDK ? 'enabled' : 'disabled, using REST fallback'})`)
      console.log(`Model: ${this.modelName}`)
    } else {
      console.warn('Google Gemini API key not found. Set GOOGLE_GEMINI_API_KEY in .env')
    }
  }

  /**
   * Try to initialize the new @google/genai SDK
   * Falls back silently if SDK is not available
   */
  private initializeSDK() {
    try {
      // Try new SDK first
      const { GoogleGenAI } = require('@google/genai')
      const genAI = new GoogleGenAI({ apiKey: this.apiKey! })
      this.sdkModel = genAI
      this.useSDK = true
      console.log('Using @google/genai SDK')
    } catch (error) {
      // SDK not installed or incompatible, will use REST fallback
      console.log('@google/genai SDK not available, using REST API fallback')
      this.useSDK = false
    }
  }

  /**
   * Generate SVG code from a natural language description
   * Uses multiple fallback strategies for reliability
   */
  async generateSVG(options: SVGGenerationOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Google Gemini API key not initialized. Set GOOGLE_GEMINI_API_KEY')
    }

    const prompt = this.buildSVGPrompt(options)
    console.log('Generating SVG with prompt length:', prompt.length)

    // Strategy 1: Try SDK if available
    if (this.useSDK && this.sdkModel) {
      try {
        return await this.generateWithSDK(prompt)
      } catch (error: any) {
        console.warn('SDK generation failed, falling back to REST API:', error.message)
        // Fall through to REST API
      }
    }

    // Strategy 2: Use REST API v1 endpoint (most reliable)
    try {
      return await this.generateWithREST(prompt)
    } catch (error: any) {
      // Strategy 3: Try alternative model if primary fails
      if (this.modelName.includes('flash')) {
        console.warn('Primary model failed, trying gemini-2.5-pro...')
        const originalModel = this.modelName
        this.modelName = 'gemini-2.5-pro'
        try {
          const result = await this.generateWithREST(prompt)
          this.modelName = originalModel // Restore original
          return result
        } catch (retryError) {
          this.modelName = originalModel // Restore original
          // Try gemini-pro as last resort (legacy model)
          console.warn('Gemini 2.5 models failed, trying legacy gemini-pro...')
          this.modelName = 'gemini-pro'
          try {
            const result = await this.generateWithREST(prompt)
            this.modelName = originalModel // Restore original
            return result
          } catch (finalError) {
            this.modelName = originalModel // Restore original
            throw new Error(`Failed to generate SVG with all models: ${error.message}`)
          }
        }
      }
      throw error
    }
  }

  /**
   * Generate using the new @google/genai SDK
   */
  private async generateWithSDK(prompt: string): Promise<string> {
    if (!this.sdkModel) {
      throw new Error('SDK not initialized')
    }

    const response = await this.sdkModel.models.generateContent({
      model: this.modelName,
      contents: [{ parts: [{ text: prompt }] }],
    })

    const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      throw new Error('No text in SDK response')
    }

    return this.extractSVG(text)
  }

  /**
   * Generate using REST API v1 endpoint (bypasses SDK issues)
   * This is the most reliable method for newer models
   */
  private async generateWithREST(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API key not available')
    }

    // Use stable v1 endpoint instead of v1beta
    const url = `https://generativelanguage.googleapis.com/v1/models/${this.modelName}:generateContent`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error?.message || errorMessage
      } catch {
        errorMessage += ` - ${errorText}`
      }

      throw new Error(errorMessage)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      throw new Error('No text in API response')
    }

    console.log('Received response from Gemini REST API, length:', text.length)
    return this.extractSVG(text)
  }

  /**
   * Extract SVG from response text
   */
  private extractSVG(text: string): string {
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
  }

  /**
   * Refine an existing SVG based on instructions
   */
  async refineSVG(existingSVG: string, instructions: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Google Gemini API key not initialized. Set GOOGLE_GEMINI_API_KEY')
    }

    const prompt = `You are an expert at working with SVG graphics. Refine the following SVG based on these instructions: "${instructions}"

Current SVG:
${existingSVG}

Please provide the refined SVG code. Only return the SVG code, no explanations.`

    // Use REST API for refinement (most reliable)
    try {
      return await this.generateWithREST(prompt)
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
    return this.apiKey !== null
  }

  /**
   * Get current model name
   */
  getModelName(): string {
    return this.modelName
  }
}

export const googleGeminiClient = new GoogleGeminiClient()
