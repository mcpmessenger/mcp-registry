/**
 * Check Playwright configuration
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPlaywrightConfig() {
  try {
    const server = await prisma.mcpServer.findUnique({
      where: { serverId: 'modelcontextprotocol/playwright' },
    })

    if (!server) {
      console.log('❌ Server not found')
      return
    }

    console.log('📦 Playwright Configuration:')
    console.log(`   Name: ${server.name}`)
    console.log(`   Command: ${server.command || 'NOT SET'}`)
    console.log(`   Args: ${server.args || 'NOT SET'}`)
    
    if (server.args) {
      try {
        const args = JSON.parse(server.args)
        console.log(`   Args (parsed): ${JSON.stringify(args)}`)
      } catch (e) {
        console.log(`   Args (parse error): ${server.args}`)
      }
    }

    console.log(`   Env: ${server.env || 'NOT SET'}`)
    
    if (server.metadata) {
      try {
        const metadata = JSON.parse(server.metadata)
        console.log(`   Metadata.npmPackage: ${metadata.npmPackage || 'NOT SET'}`)
      } catch (e) {
        console.log('   Metadata: (parse error)')
      }
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkPlaywrightConfig()
