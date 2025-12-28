import { PrismaClient } from '@prisma/client'
import { env } from './env'

// Prisma Client with connection pooling
export const prisma = new PrismaClient({
  log: env.server.nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})

export default prisma













