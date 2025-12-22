import { prisma } from '../config/database'
import { JobStatus } from '@prisma/client'
import type { Prisma } from '@prisma/client'

export class DurableTaskRepository {
  async findById(id: string) {
    return prisma.durableTask.findUnique({
      where: { id },
      include: {
        server: true,
      },
    })
  }

  async findByTaskId(taskId: string) {
    return prisma.durableTask.findUnique({
      where: { taskId },
      include: {
        server: true,
      },
    })
  }

  async findByServerId(serverId: string) {
    return prisma.durableTask.findMany({
      where: { serverId },
      include: {
        server: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findAll(where?: Prisma.DurableTaskWhereInput) {
    return prisma.durableTask.findMany({
      where,
      include: {
        server: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(data: Prisma.DurableTaskCreateInput) {
    return prisma.durableTask.create({
      data,
      include: {
        server: true,
      },
    })
  }

  async update(id: string, data: Prisma.DurableTaskUpdateInput) {
    return prisma.durableTask.update({
      where: { id },
      data,
      include: {
        server: true,
      },
    })
  }

  async updateStatus(
    id: string,
    status: JobStatus,
    progress?: number,
    progressMessage?: string,
    output?: string
  ) {
    const updateData: Prisma.DurableTaskUpdateInput = {
      status,
      ...(progress !== undefined && { progress }),
      ...(progressMessage && { progressMessage }),
      ...(output && { output }),
      ...(status === 'COMPLETED' || status === 'FAILED' ? { completedAt: new Date() } : {}),
    }

    return prisma.durableTask.update({
      where: { id },
      data: updateData,
      include: {
        server: true,
      },
    })
  }

  async delete(id: string) {
    return prisma.durableTask.delete({
      where: { id },
    })
  }
}

export const durableTaskRepository = new DurableTaskRepository()

