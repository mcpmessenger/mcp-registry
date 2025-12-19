import { prisma } from '../config/database'
import { JobStatus } from '@prisma/client'
import type { Prisma } from '@prisma/client'

export class DesignJobRepository {
  async findById(id: string) {
    return prisma.designJob.findUnique({
      where: { id },
      include: {
        assets: true,
        server: true,
      },
    })
  }

  async findAll(where?: Prisma.DesignJobWhereInput) {
    return prisma.designJob.findMany({
      where,
      include: {
        assets: true,
        server: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(data: Prisma.DesignJobCreateInput) {
    return prisma.designJob.create({
      data,
      include: {
        assets: true,
        server: true,
      },
    })
  }

  async update(id: string, data: Prisma.DesignJobUpdateInput) {
    return prisma.designJob.update({
      where: { id },
      data,
      include: {
        assets: true,
        server: true,
      },
    })
  }

  async updateStatus(id: string, status: JobStatus, progress?: number, progressMessage?: string) {
    const updateData: Prisma.DesignJobUpdateInput = {
      status,
      ...(progress !== undefined && { progress }),
      ...(progressMessage && { progressMessage }),
      ...(status === 'COMPLETED' || status === 'FAILED' ? { completedAt: new Date() } : {}),
    }

    return prisma.designJob.update({
      where: { id },
      data: updateData,
      include: {
        assets: true,
        server: true,
      },
    })
  }

  async delete(id: string) {
    return prisma.designJob.delete({
      where: { id },
    })
  }
}

export const designJobRepository = new DesignJobRepository()
