/**
 * Fix Exa Search package name - Update to correct package
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixExaPackage() {
  console.log('🔧 Fixing Exa Search package name...\n')

  try {
    const server = await prisma.mcpServer.findUnique({
      where: { serverId: 'modelcontextprotocol/exa' },
    })

    if (!server) {
      console.log('❌ Server not found')
      return
    }

    console.log(`📦 Found server: ${server.name}`)
    console.log(`   Current args: ${server.args}`)

    // Parse existing env to preserve API key
    let env: Record<string, string> = {}
    if (server.env) {
      try {
        env = JSON.parse(server.env)
      } catch (e) {
        console.warn('Failed to parse existing env')
      }
    }

    // Parse existing metadata
    let metadata: Record<string, unknown> = {}
    if (server.metadata) {
      try {
        metadata = JSON.parse(server.metadata)
      } catch (e) {
        console.warn('Failed to parse existing metadata')
      }
    }

    // Update args to correct package
    const newArgs = JSON.stringify(['-y', 'exa-mcp-server'])
    
    // Update metadata npmPackage
    metadata.npmPackage = 'exa-mcp-server'
    metadata.documentation = 'https://github.com/exa-labs/exa-mcp-server'
    metadata.publisher = 'Exa Labs'

    const updated = await prisma.mcpServer.update({
      where: { serverId: 'modelcontextprotocol/exa' },
      data: {
        args: newArgs,
        metadata: JSON.stringify(metadata),
        description: 'Neural search engine integration with web search, code search, crawling and research tools via Exa AI. Supports web search, deep search, code context retrieval, company research, LinkedIn search, and more.',
      },
    })

    console.log(`✅ Successfully updated!`)
    console.log(`   New args: ${updated.args}`)
    console.log(`   API Key: ${env.EXA_API_KEY ? 'PRESERVED' : 'NOT SET'}`)
    console.log(`   Next: Refresh the UI and try again\n`)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

fixExaPackage()
