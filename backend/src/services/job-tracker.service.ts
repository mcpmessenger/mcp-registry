import { JobStatus } from '@prisma/client'
import { designJobRepository } from '../repositories/design-job.repository'
import type { EventEmitter } from 'events'

export interface JobProgressUpdate {
  jobId: string
  status: JobStatus
  progress: number
  progressMessage?: string
  errorMessage?: string
}

export class JobTrackerService {
  private progressListeners: Map<string, Set<(update: JobProgressUpdate) => void>> = new Map()

  /**
   * Create a new design job
   */
  async createJob(data: {
    description: string
    serverId?: string
    refinementNotes?: string
  }) {
    const job = await designJobRepository.create({
      description: data.description,
      refinementNotes: data.refinementNotes,
      status: 'PENDING',
      progress: 0,
      ...(data.serverId && {
        server: {
          connect: {
            id: data.serverId,
          },
        },
      }),
    })

    return job
  }

  /**
   * Update job progress
   */
  async updateProgress(
    jobId: string,
    status: JobStatus,
    progress: number,
    progressMessage?: string,
    errorMessage?: string
  ) {
    const job = await designJobRepository.updateStatus(
      jobId,
      status,
      progress,
      progressMessage
    )

    if (errorMessage) {
      await designJobRepository.update(jobId, {
        errorMessage,
      })
    }

    // Broadcast progress update to all listeners
    const update: JobProgressUpdate = {
      jobId,
      status,
      progress,
      progressMessage,
      errorMessage,
    }

    this.broadcastProgress(jobId, update)

    return job
  }

  /**
   * Subscribe to job progress updates
   */
  subscribe(jobId: string, callback: (update: JobProgressUpdate) => void): () => void {
    if (!this.progressListeners.has(jobId)) {
      this.progressListeners.set(jobId, new Set())
    }

    this.progressListeners.get(jobId)!.add(callback)

    // Return unsubscribe function
    return () => {
      const listeners = this.progressListeners.get(jobId)
      if (listeners) {
        listeners.delete(callback)
        if (listeners.size === 0) {
          this.progressListeners.delete(jobId)
        }
      }
    }
  }

  /**
   * Broadcast progress update to all subscribers
   */
  private broadcastProgress(jobId: string, update: JobProgressUpdate) {
    const listeners = this.progressListeners.get(jobId)
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(update)
        } catch (error) {
          console.error(`Error in progress listener for job ${jobId}:`, error)
        }
      })
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string) {
    return designJobRepository.findById(jobId)
  }

  /**
   * Mark job as completed
   */
  async completeJob(jobId: string, progressMessage?: string) {
    return this.updateProgress(jobId, 'COMPLETED', 100, progressMessage)
  }

  /**
   * Mark job as failed
   */
  async failJob(jobId: string, errorMessage: string) {
    return this.updateProgress(jobId, 'FAILED', 0, undefined, errorMessage)
  }
}

export const jobTrackerService = new JobTrackerService()
