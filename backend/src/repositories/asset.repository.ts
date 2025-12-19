import { prisma } from '../config/database'
import type { Prisma } from '@prisma/client'

export class AssetRepository {
  async findById(id: string) {
    return prisma.asset.findUnique({
      where: { id },
      include: {
        job: true,
      },
    })
  }

  async findByJobId(jobId: string) {
    return prisma.asset.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findLatestByJobId(jobId: string) {
    return prisma.asset.findFirst({
      where: {
        jobId,
        isLatest: true,
      },
    })
  }

  async create(data: Prisma.AssetCreateInput) {
    // If this is marked as latest, unmark other assets for the same job
    if (data.isLatest && data.job?.connect?.id) {
      await prisma.asset.updateMany({
        where: {
          jobId: data.job.connect.id,
          isLatest: true,
        },
        data: {
          isLatest: false,
        },
      })
    }

    return prisma.asset.create({
      data,
      include: {
        job: true,
      },
    })
  }

  async update(id: string, data: Prisma.AssetUpdateInput) {
    return prisma.asset.update({
      where: { id },
      data,
      include: {
        job: true,
      },
    })
  }

  async delete(id: string) {
    return prisma.asset.delete({
      where: { id },
    })
  }
}

export const assetRepository = new AssetRepository()
