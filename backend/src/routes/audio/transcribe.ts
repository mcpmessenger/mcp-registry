import { Router } from 'express'
import multer from 'multer'
import { whisperService } from '../../services/whisper.service'
import { z } from 'zod'

const router = Router()

// Configure multer for memory storage (we'll send the buffer directly to Whisper)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit (Whisper API limit)
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    const allowedMimes = [
      'audio/mpeg',
      'audio/mp4',
      'audio/mp3',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
      'audio/x-m4a',
      'audio/x-wav',
    ]
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedMimes.join(', ')}`))
    }
  },
})

const transcribeSchema = z.object({
  language: z.string().optional(),
})

/**
 * POST /api/audio/transcribe
 * Transcribe audio using OpenAI Whisper API
 */
router.post('/transcribe', upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided',
      })
    }

    // Parse optional query parameters
    const queryParams = transcribeSchema.parse(req.query)
    const language = queryParams.language

    console.log('Received audio file:', {
      size: req.file.size,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    })

    // Transcribe the audio
    const result = await whisperService.transcribeWithDetails(req.file.buffer, language)

    console.log('Transcription successful:', {
      textLength: result.text.length,
      language: result.language,
    })

    res.json({
      success: true,
      text: result.text,
      language: result.language,
    })
  } catch (error: any) {
    console.error('Transcription endpoint error:', error)
    
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File too large. Maximum size is 25MB.',
        })
      }
      return res.status(400).json({
        success: false,
        error: `Upload error: ${error.message}`,
      })
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      })
    }

    // Provide more detailed error response
    const errorMessage = error?.message || 'Unknown error occurred'
    const statusCode = error?.statusCode || 500
    
    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
  }
})

export default router
