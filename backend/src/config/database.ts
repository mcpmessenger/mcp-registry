import { PrismaClient } from '@prisma/client'
import { env } from './env'

const dbUrl = process.env.DATABASE_URL || env.database.url

if (!dbUrl) {
  throw new Error('DATABASE_URL is missing; impossible to start the backend')
}

// Only warn in development about localhost URLs
if (env.server.nodeEnv === 'development' && !dbUrl.includes('54322') && (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1'))) {
  console.warn(
    '⚠️ DATABASE_URL does not point to Supabase (54322); double-check your env files.'
  )
}

// Prisma Client with connection pooling
export const prisma = new PrismaClient({
  log: env.server.nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: dbUrl,
    },
  },
})

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})

export default prisma














