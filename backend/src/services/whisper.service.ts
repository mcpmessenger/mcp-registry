import OpenAI from 'openai'
import { env } from '../config/env'

export class WhisperService {
  private client: OpenAI | null = null

  constructor() {
    if (env.openai.apiKey) {
      this.client = new OpenAI({
        apiKey: env.openai.apiKey,
      })
    } else {
      console.warn('OpenAI API key not set. Whisper transcription will not be available.')
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper API
   * @param audioBuffer - Audio file buffer (supports mp3, mp4, mpeg, mpga, m4a, wav, webm)
   * @param language - Optional language code (e.g., 'en', 'es', 'fr')
   * @returns Transcribed text
   */
  async transcribe(audioBuffer: Buffer, language?: string): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.')
    }

    try {
      // OpenAI SDK accepts File, Blob, Buffer, or ReadStream
      // For Node.js, we can use the buffer directly with proper metadata
      let file: any = audioBuffer
      
      // Try to use Node.js File API if available (Node 18+)
      try {
        const { File: NodeFile } = await import('node:buffer')
        // Convert Buffer to Uint8Array for File constructor compatibility
        const uint8Array = new Uint8Array(audioBuffer)
        file = new NodeFile([uint8Array], 'audio.webm', {
          type: 'audio/webm',
        })
      } catch {
        // Fallback: create a file-like object with required properties
        file = Object.assign(audioBuffer, {
          name: 'audio.webm',
          type: 'audio/webm',
          stream: () => {
            const { Readable } = require('stream')
            return Readable.from([audioBuffer])
          },
        })
      }

      const transcription = await this.client.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: language || undefined,
        response_format: 'text',
      })

      return transcription as unknown as string
    } catch (error: any) {
      console.error('Whisper transcription error:', error)
      
      if (error?.response) {
        const errorData = error.response.data || error.response
        const errorMessage = errorData?.error?.message || errorData?.message || error.message
        throw new Error(`Transcription failed: ${errorMessage}`)
      }
      
      if (error instanceof Error) {
        throw new Error(`Transcription failed: ${error.message}`)
      }
      throw new Error('Transcription failed: Unknown error')
    }
  }

  /**
   * Transcribe audio and return structured response
   * @param audioBuffer - Audio file buffer
   * @param language - Optional language code
   * @returns Transcription result with confidence and segments
   */
  async transcribeWithDetails(audioBuffer: Buffer, language?: string): Promise<{
    text: string
    language?: string
  }> {
    if (!this.client) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.')
    }

    try {
      // OpenAI SDK accepts File, Blob, Buffer, or ReadStream
      // For Node.js, we can use the buffer directly with proper metadata
      // Create a File-like object that the SDK can handle
      let file: any = audioBuffer
      
      // Try to use Node.js File API if available (Node 18+)
      try {
        const { File: NodeFile } = await import('node:buffer')
        // Convert Buffer to Uint8Array for File constructor compatibility
        const uint8Array = new Uint8Array(audioBuffer)
        file = new NodeFile([uint8Array], 'audio.webm', {
          type: 'audio/webm',
        })
      } catch {
        // Fallback: create a file-like object with required properties
        file = Object.assign(audioBuffer, {
          name: 'audio.webm',
          type: 'audio/webm',
          stream: () => {
            const { Readable } = require('stream')
            return Readable.from([audioBuffer])
          },
        })
      }

      const transcription = await this.client.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: language || undefined,
        response_format: 'verbose_json',
      })

      return {
        text: transcription.text,
        language: transcription.language,
      }
    } catch (error: any) {
      console.error('Whisper transcription error:', error)
      
      // Provide more detailed error information
      if (error?.response) {
        const errorData = error.response.data || error.response
        const errorMessage = errorData?.error?.message || errorData?.message || error.message
        throw new Error(`Transcription failed: ${errorMessage}`)
      }
      
      if (error instanceof Error) {
        throw new Error(`Transcription failed: ${error.message}`)
      }
      throw new Error('Transcription failed: Unknown error')
    }
  }
}

export const whisperService = new WhisperService()
