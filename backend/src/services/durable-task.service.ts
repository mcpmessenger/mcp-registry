/**
 * Durable Task Service (SEP-1686)
 * 
 * Manages long-running async tasks across MCP servers.
 * Acts as a status monitor for durable requests.
 */

import { durableTaskRepository } from '../repositories/durable-task.repository'
import { JobStatus } from '@prisma/client'
import type { Prisma } from '@prisma/client'

export interface CreateTaskInput {
  taskId: string
  serverId: string
  taskType?: string
  description?: string
  input?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface UpdateTaskProgressInput {
  progress?: number
  progressMessage?: string
  output?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export class DurableTaskService {
  /**
   * Create a new durable task
   */
  async createTask(input: CreateTaskInput) {
    return durableTaskRepository.create({
      taskId: input.taskId,
      server: {
        connect: { serverId: input.serverId },
      },
      taskType: input.taskType,
      description: input.description,
      input: input.input ? JSON.stringify(input.input) : null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      status: 'PENDING',
      progress: 0,
    })
  }

  /**
   * Get task by ID
   */
  async getTaskById(id: string) {
    return durableTaskRepository.findById(id)
  }

  /**
   * Get task by external task ID
   */
  async getTaskByTaskId(taskId: string) {
    return durableTaskRepository.findByTaskId(taskId)
  }

  /**
   * Get all tasks for a server
   */
  async getTasksByServerId(serverId: string) {
    return durableTaskRepository.findByServerId(serverId)
  }

  /**
   * Get all tasks with optional filters
   */
  async getAllTasks(filters?: {
    serverId?: string
    status?: JobStatus
    taskType?: string
  }) {
    const where: Prisma.DurableTaskWhereInput = {}
    
    if (filters?.serverId) {
      where.serverId = filters.serverId
    }
    
    if (filters?.status) {
      where.status = filters.status
    }
    
    if (filters?.taskType) {
      where.taskType = filters.taskType
    }
    
    return durableTaskRepository.findAll(where)
  }

  /**
   * Update task progress
   */
  async updateTaskProgress(
    taskId: string,
    input: UpdateTaskProgressInput
  ) {
    const task = await durableTaskRepository.findByTaskId(taskId)
    
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }
    
    const updateData: Prisma.DurableTaskUpdateInput = {}
    
    if (input.progress !== undefined) {
      updateData.progress = input.progress
    }
    
    if (input.progressMessage) {
      updateData.progressMessage = input.progressMessage
    }
    
    if (input.output) {
      updateData.output = JSON.stringify(input.output)
    }
    
    if (input.metadata) {
      updateData.metadata = JSON.stringify(input.metadata)
    }
    
    return durableTaskRepository.update(task.id, updateData)
  }

  /**
   * Mark task as completed
   */
  async completeTask(taskId: string, output?: Record<string, unknown>) {
    const task = await durableTaskRepository.findByTaskId(taskId)
    
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }
    
    return durableTaskRepository.updateStatus(
      task.id,
      'COMPLETED',
      100,
      'Task completed successfully',
      output ? JSON.stringify(output) : undefined
    )
  }

  /**
   * Mark task as failed
   */
  async failTask(taskId: string, errorMessage: string) {
    const task = await durableTaskRepository.findByTaskId(taskId)
    
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }
    
    return durableTaskRepository.updateStatus(
      task.id,
      'FAILED',
      task.progress,
      errorMessage
    )
  }

  /**
   * Delete a task
   */
  async deleteTask(id: string) {
    return durableTaskRepository.delete(id)
  }
}

export const durableTaskService = new DurableTaskService()

