import { Router } from 'express'
import multer from 'multer'
import { documentAnalysisService } from '../../services/document-analysis.service'
import { z } from 'zod'

const router = Router()

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images, PDFs, and text files
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
    ]
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedMimes.join(', ')}`))
    }
  },
})

const analyzeSchema = z.object({
  query: z.string().optional(),
})

/**
 * POST /api/documents/analyze
 * Analyze a document (PDF, image, text) using Gemini Vision API
 */
router.post('/analyze', upload.single('document'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No document file provided',
      })
    }

    // Parse optional query parameter
    const queryParams = analyzeSchema.parse(req.query || {})
    const query = queryParams.query

    console.log('Analyzing document:', {
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      hasQuery: !!query,
    })

    // Analyze the document
    const result = await documentAnalysisService.analyzeDocument({
      file: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      query,
    })

    if (result.error) {
      return res.status(500).json({
        success: false,
        error: result.error,
      })
    }

    res.json({
      success: true,
      analysis: result,
    })
  } catch (error) {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File too large. Maximum size is 20MB.',
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

    console.error('Document analysis endpoint error:', error)
    next(error)
  }
})

export default router
