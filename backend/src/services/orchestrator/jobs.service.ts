import { randomUUID } from 'crypto'
import { JobStatus, type OrchestratorJob } from '@prisma/client'
import prisma from '../../config/database'
import { publishUserRequest } from './ingress'

export type CreateJobInput = {
  query: string
  sessionId?: string
  contextSnapshot?: Record<string, unknown>
}

export class OrchestratorJobsService {
  async createJob(input: CreateJobInput): Promise<OrchestratorJob> {
    const jobId = randomUUID()
    const requestId = randomUUID()

    const job = await prisma.orchestratorJob.create({
      data: {
        id: jobId,
        requestId,
        query: input.query,
        sessionId: input.sessionId,
        status: JobStatus.PENDING,
      },
    })

    try {
      await publishUserRequest(input.query, input.sessionId, input.contextSnapshot, requestId)

      return await prisma.orchestratorJob.update({
        where: { id: jobId },
        data: { status: JobStatus.PROCESSING },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await prisma.orchestratorJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.FAILED,
          errorMessage: message,
          completedAt: new Date(),
        },
      })
      throw error
    }
  }

  async getJob(jobId: string): Promise<OrchestratorJob | null> {
    return prisma.orchestratorJob.findUnique({ where: { id: jobId } })
  }

  async cancelJob(jobId: string): Promise<OrchestratorJob> {
    return prisma.orchestratorJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.CANCELLED,
        completedAt: new Date(),
      },
    })
  }
}

export const orchestratorJobsService = new OrchestratorJobsService()

