import { prisma } from '../config/database'
import type { Prisma } from '@prisma/client'

export class McpServerRepository {
  async findById(id: string) {
    return prisma.mcpServer.findUnique({
      where: { id },
    })
  }

  async findByServerId(serverId: string) {
    return prisma.mcpServer.findUnique({
      where: { serverId },
    })
  }

  async findAll(where?: Prisma.McpServerWhereInput) {
    return prisma.mcpServer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(data: Prisma.McpServerCreateInput) {
    return prisma.mcpServer.create({ data })
  }

  async update(id: string, data: Prisma.McpServerUpdateInput) {
    return prisma.mcpServer.update({
      where: { id },
      data,
    })
  }

  async delete(id: string) {
    return prisma.mcpServer.delete({
      where: { id },
    })
  }
}

export const mcpServerRepository = new McpServerRepository()
