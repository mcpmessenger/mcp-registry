/**
 * Durable Tasks API (SEP-1686)
 * 
 * Endpoints for managing and monitoring long-running tasks across MCP servers
 */

import { Router } from 'express'
import { z } from 'zod'
import { durableTaskService } from '../services/durable-task.service'
import { authenticateUser } from '../middleware/auth.middleware'
import { JobStatus } from '@prisma/client'

const router = Router()

/**
 * GET /api/tasks
 * Get all durable tasks with optional filters
 */
router.get('/', async (req, res, next) => {
  try {
    const { serverId, status, taskType } = req.query
    
    const filters: any = {}
    if (serverId) filters.serverId = serverId as string
    if (status) filters.status = status as JobStatus
    if (taskType) filters.taskType = taskType as string
    
    const tasks = await durableTaskService.getAllTasks(filters)
    
    // Transform tasks to include parsed JSON fields
    const transformedTasks = tasks.map(task => ({
      ...task,
      input: task.input ? JSON.parse(task.input) : null,
      output: task.output ? JSON.parse(task.output) : null,
      metadata: task.metadata ? JSON.parse(task.metadata) : null,
    }))
    
    res.json({
      success: true,
      tasks: transformedTasks,
      count: transformedTasks.length,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/tasks/:id
 * Get a specific task by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const task = await durableTaskService.getTaskById(id)
    
    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        taskId: id,
      })
    }
    
    // Transform task to include parsed JSON fields
    const transformedTask = {
      ...task,
      input: task.input ? JSON.parse(task.input) : null,
      output: task.output ? JSON.parse(task.output) : null,
      metadata: task.metadata ? JSON.parse(task.metadata) : null,
    }
    
    res.json({
      success: true,
      task: transformedTask,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/tasks/task-id/:taskId
 * Get a task by external task ID
 */
router.get('/task-id/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params
    const task = await durableTaskService.getTaskByTaskId(taskId)
    
    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        taskId,
      })
    }
    
    // Transform task to include parsed JSON fields
    const transformedTask = {
      ...task,
      input: task.input ? JSON.parse(task.input) : null,
      output: task.output ? JSON.parse(task.output) : null,
      metadata: task.metadata ? JSON.parse(task.metadata) : null,
    }
    
    res.json({
      success: true,
      task: transformedTask,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/tasks/server/:serverId
 * Get all tasks for a specific server
 */
router.get('/server/:serverId', async (req, res, next) => {
  try {
    const { serverId } = req.params
    const tasks = await durableTaskService.getTasksByServerId(serverId)
    
    // Transform tasks to include parsed JSON fields
    const transformedTasks = tasks.map(task => ({
      ...task,
      input: task.input ? JSON.parse(task.input) : null,
      output: task.output ? JSON.parse(task.output) : null,
      metadata: task.metadata ? JSON.parse(task.metadata) : null,
    }))
    
    res.json({
      success: true,
      tasks: transformedTasks,
      count: transformedTasks.length,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/tasks
 * Create a new durable task
 */
const createTaskSchema = z.object({
  taskId: z.string().min(1),
  serverId: z.string().min(1),
  taskType: z.string().optional(),
  description: z.string().optional(),
  input: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
})

router.post('/', authenticateUser, async (req, res, next) => {
  try {
    const validated = createTaskSchema.parse(req.body)
    const task = await durableTaskService.createTask(validated)
    
    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task: {
        ...task,
        input: task.input ? JSON.parse(task.input) : null,
        output: task.output ? JSON.parse(task.output) : null,
        metadata: task.metadata ? JSON.parse(task.metadata) : null,
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * PATCH /api/tasks/:taskId/progress
 * Update task progress
 */
const updateProgressSchema = z.object({
  progress: z.number().min(0).max(100).optional(),
  progressMessage: z.string().optional(),
  output: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
})

router.patch('/:taskId/progress', authenticateUser, async (req, res, next) => {
  try {
    const { taskId } = req.params
    const validated = updateProgressSchema.parse(req.body)
    
    const task = await durableTaskService.updateTaskProgress(taskId, validated)
    
    res.json({
      success: true,
      message: 'Task progress updated',
      task: {
        ...task,
        input: task.input ? JSON.parse(task.input) : null,
        output: task.output ? JSON.parse(task.output) : null,
        metadata: task.metadata ? JSON.parse(task.metadata) : null,
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/tasks/:taskId/complete
 * Mark a task as completed
 */
router.post('/:taskId/complete', authenticateUser, async (req, res, next) => {
  try {
    const { taskId } = req.params
    const { output } = req.body
    
    const task = await durableTaskService.completeTask(taskId, output)
    
    res.json({
      success: true,
      message: 'Task completed',
      task: {
        ...task,
        input: task.input ? JSON.parse(task.input) : null,
        output: task.output ? JSON.parse(task.output) : null,
        metadata: task.metadata ? JSON.parse(task.metadata) : null,
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/tasks/:taskId/fail
 * Mark a task as failed
 */
router.post('/:taskId/fail', authenticateUser, async (req, res, next) => {
  try {
    const { taskId } = req.params
    const { errorMessage } = req.body
    
    if (!errorMessage) {
      return res.status(400).json({
        error: 'errorMessage is required',
      })
    }
    
    const task = await durableTaskService.failTask(taskId, errorMessage)
    
    res.json({
      success: true,
      message: 'Task marked as failed',
      task: {
        ...task,
        input: task.input ? JSON.parse(task.input) : null,
        output: task.output ? JSON.parse(task.output) : null,
        metadata: task.metadata ? JSON.parse(task.metadata) : null,
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/tasks/:id
 * Delete a task
 */
router.delete('/:id', authenticateUser, async (req, res, next) => {
  try {
    const { id } = req.params
    await durableTaskService.deleteTask(id)
    
    res.json({
      success: true,
      message: 'Task deleted successfully',
    })
  } catch (error) {
    next(error)
  }
})

export default router

