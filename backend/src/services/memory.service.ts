import { prisma } from '../config/database'
import type { Prisma } from '@prisma/client'

export type MemoryType = 'preference' | 'fact' | 'context' | 'instruction'

export interface MemoryInput {
  conversationId?: string
  userId?: string
  type: MemoryType
  key: string
  value: any // Will be JSON stringified
  importance?: number // 1-10
  expiresAt?: Date
}

export interface ContextData {
  toolOutputs?: Record<string, any>
  conversationState?: Record<string, any>
  userPreferences?: Record<string, any>
  learnedFacts?: Record<string, any>
}

export class MemoryService {
  private buildKeyWhere(input: Pick<MemoryInput, 'conversationId' | 'userId' | 'key'>): Prisma.MemoryWhereInput {
    const where: Prisma.MemoryWhereInput = {
      key: input.key,
    }

    if (input.conversationId) {
      where.conversationId = input.conversationId
    }

    if (input.userId) {
      where.userId = input.userId
    }

    return where
  }

  private async upsertMemoryRecord(input: MemoryInput): Promise<void> {
    const serializedValue = JSON.stringify(input.value)
    const where = this.buildKeyWhere(input)

    const existing = await prisma.memory.findFirst({ where })

    if (existing) {
      await prisma.memory.update({
        where: { id: existing.id },
        data: {
          value: serializedValue,
          type: input.type,
          importance: input.importance ?? existing.importance,
          expiresAt: input.expiresAt,
          lastAccessed: new Date(),
          accessCount: { increment: 1 },
        },
      })
    } else {
      await prisma.memory.create({
        data: {
          conversationId: input.conversationId,
          userId: input.userId,
          type: input.type,
          key: input.key,
          value: serializedValue,
          importance: input.importance ?? 5,
          expiresAt: input.expiresAt,
        },
      })
    }
  }

  /**
   * Upsert context data for a conversation
   * Stores tool outputs, conversation state, and other context
   */
  async upsertContext(conversationId: string, context: ContextData): Promise<void> {
    // Store tool outputs as context memories
    if (context.toolOutputs) {
      for (const [toolName, output] of Object.entries(context.toolOutputs)) {
        await this.upsertMemoryRecord({
          conversationId,
          type: 'context',
          key: `tool_output:${toolName}`,
          value: output,
          importance: 5,
        })
      }
    }

    // Store conversation state
    if (context.conversationState) {
      await this.upsertMemoryRecord({
        conversationId,
        type: 'context',
        key: 'conversation_state',
        value: context.conversationState,
        importance: 7,
      })
    }

    // Store user preferences
    if (context.userPreferences) {
      const userId = context.userPreferences.userId

      for (const [key, value] of Object.entries(context.userPreferences)) {
        if (key === 'userId') {
          continue
        }

        await this.upsertMemoryRecord({
          conversationId: userId ? undefined : conversationId,
          userId: userId || undefined,
          type: 'preference',
          key: `preference:${key}`,
          value,
          importance: 8,
        })
      }
    }

    // Store learned facts
    if (context.learnedFacts) {
      for (const [key, value] of Object.entries(context.learnedFacts)) {
        await this.upsertMemoryRecord({
          conversationId,
          type: 'fact',
          key: `fact:${key}`,
          value,
          importance: 6,
        })
      }
    }
  }

  /**
   * Search conversation history
   * Returns relevant memories based on query
   */
  async searchHistory(
    conversationId: string,
    query: string,
    options?: {
      limit?: number
      types?: MemoryType[]
      minImportance?: number
    }
  ): Promise<Array<{ key: string; value: any; type: MemoryType; importance: number }>> {
    const where: Prisma.MemoryWhereInput = {
      conversationId,
      ...(options?.types && { type: { in: options.types } }),
      ...(options?.minImportance && { importance: { gte: options.minImportance } }),
      OR: [
        { key: { contains: query } },
        { value: { contains: query } },
      ],
    }

    const memories = await prisma.memory.findMany({
      where,
      orderBy: [
        { importance: 'desc' },
        { accessCount: 'desc' },
        { lastAccessed: 'desc' },
      ],
      take: options?.limit || 10,
    })

    return memories.map((m) => ({
      key: m.key,
      value: JSON.parse(m.value),
      type: m.type as MemoryType,
      importance: m.importance,
    }))
  }

  /**
   * Get memories for a conversation
   */
  async getMemories(
    conversationId: string,
    options?: {
      types?: MemoryType[]
      userId?: string
    }
  ): Promise<Array<{ key: string; value: any; type: MemoryType }>> {
    const where: Prisma.MemoryWhereInput = {
      OR: [
        { conversationId },
        ...(options?.userId ? [{ userId: options.userId }] : []),
      ],
      ...(options?.types && { type: { in: options.types } }),
    }

    const memories = await prisma.memory.findMany({
      where,
      orderBy: [{ importance: 'desc' }, { lastAccessed: 'desc' }],
    })

    return memories.map((m) => ({
      key: m.key,
      value: JSON.parse(m.value),
      type: m.type as MemoryType,
    }))
  }

  /**
   * Store a memory
   * Handles uniqueness manually since Prisma doesn't support unique on nullable fields
   */
  async storeMemory(input: MemoryInput): Promise<void> {
    await this.upsertMemoryRecord(input)
  }

  /**
   * Update memory access (for prioritization)
   */
  async recordAccess(memoryId: string): Promise<void> {
    await prisma.memory.update({
      where: { id: memoryId },
      data: {
        accessCount: { increment: 1 },
        lastAccessed: new Date(),
      },
    })
  }
}

export const memoryService = new MemoryService()
