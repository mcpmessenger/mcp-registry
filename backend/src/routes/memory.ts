import { Router } from 'express'
import { z } from 'zod'
import { memoryService } from '../services/memory.service'

const router = Router()

const storeMemorySchema = z.object({
  conversationId: z.string().optional(),
  userId: z.string().optional(),
  type: z.enum(['preference', 'fact', 'context', 'instruction']),
  key: z.string().min(1),
  value: z.any(),
  importance: z.number().min(1).max(10).optional(),
  expiresAt: z.string().datetime().optional(),
})

const searchHistorySchema = z.object({
  conversationId: z.string().min(1),
  query: z.string().min(1),
  limit: z.number().int().positive().optional(),
  types: z.array(z.enum(['preference', 'fact', 'context', 'instruction'])).optional(),
  minImportance: z.number().min(1).max(10).optional(),
})

const upsertContextSchema = z.object({
  conversationId: z.string().min(1),
  context: z.object({
    toolOutputs: z.record(z.any()).optional(),
    conversationState: z.record(z.any()).optional(),
    userPreferences: z.record(z.any()).optional(),
    learnedFacts: z.record(z.any()).optional(),
  }),
})

/**
 * POST /api/memory
 * Store a memory
 */
router.post('/', async (req, res, next) => {
  try {
    const validated = storeMemorySchema.parse(req.body)

    await memoryService.storeMemory({
      conversationId: validated.conversationId,
      userId: validated.userId,
      type: validated.type,
      key: validated.key,
      value: validated.value,
      importance: validated.importance,
      expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : undefined,
    })

    res.json({
      success: true,
      message: 'Memory stored successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      })
    }
    next(error)
  }
})

/**
 * POST /api/memory/search
 * Search conversation history
 */
router.post('/search', async (req, res, next) => {
  try {
    const validated = searchHistorySchema.parse(req.body)

    const memories = await memoryService.searchHistory(
      validated.conversationId,
      validated.query,
      {
        limit: validated.limit,
        types: validated.types,
        minImportance: validated.minImportance,
      }
    )

    res.json({
      success: true,
      memories,
      count: memories.length,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      })
    }
    next(error)
  }
})

/**
 * GET /api/memory
 * Get memories for a conversation or user
 */
router.get('/', async (req, res, next) => {
  try {
    const { conversationId, userId, types } = req.query

    if (!conversationId && !userId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId or userId is required',
      })
    }

    const memories = await memoryService.getMemories(conversationId as string, {
      types: types ? (types as string).split(',') as any : undefined,
      userId: userId as string | undefined,
    })

    res.json({
      success: true,
      memories,
      count: memories.length,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/memory/context
 * Upsert context data for a conversation
 */
router.post('/context', async (req, res, next) => {
  try {
    const validated = upsertContextSchema.parse(req.body)

    await memoryService.upsertContext(
      validated.conversationId,
      validated.context
    )

    res.json({
      success: true,
      message: 'Context updated successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      })
    }
    next(error)
  }
})

export default router
