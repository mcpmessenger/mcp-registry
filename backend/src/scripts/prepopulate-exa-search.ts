/**
 * Prepopulate Exa Search MCP Server - Set all fields except API key
 * 
 * This script updates the existing modelcontextprotocol/exa server
 * with correct configuration: package name, command, args, description, metadata
 * The user will need to add EXA_API_KEY in the env field via UI
 * 
 * Note: Exa can also be used as HTTP server at https://mcp.exa.ai/mcp
 * but this script sets it up as STDIO server with the npm package
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function prepopulateExaSearch() {
  console.log('🔧 Prepopulating Exa Search MCP Server configuration...\n')

  try {
    // Find the existing server
    const existingServer = await prisma.mcpServer.findUnique({
      where: { serverId: 'modelcontextprotocol/exa' },
    })

    if (!existingServer) {
      console.log('❌ Server modelcontextprotocol/exa not found')
      console.log('   You may need to register it first with: npm run register-top-20')
      return
    }

    console.log(`📦 Found server: ${existingServer.name}`)
    
    // Parse existing metadata
    let existingMetadata: Record<string, unknown> = {}
    if (existingServer.metadata) {
      try {
        existingMetadata = JSON.parse(existingServer.metadata)
      } catch (e) {
        console.warn('Failed to parse existing metadata, will create new')
      }
    }

    // Build updated metadata
    const metadata = {
      ...existingMetadata,
      source: 'official',
      publisher: 'Exa Labs',
      verified: true,
      requiresEnv: true,
      envVars: ['EXA_API_KEY'],
      npmPackage: 'exa-mcp-server',
      documentation: 'https://github.com/exa-labs/exa-mcp-server',
    }

    // Set env with placeholder (user will replace with real key)
    const env = {
      EXA_API_KEY: 'YOUR_API_KEY_HERE',
    }

    // Update server with all fields
    const updated = await prisma.mcpServer.update({
      where: { serverId: 'modelcontextprotocol/exa' },
      data: {
        name: 'Exa Search',
        description: 'Neural search engine integration with web search, code search, crawling and research tools via Exa AI. Supports web search, deep search, code context retrieval, company research, LinkedIn search, and more.',
        command: 'npx',
        args: JSON.stringify(['-y', 'exa-mcp-server']),
        env: JSON.stringify(env),
        metadata: JSON.stringify(metadata),
        version: 'v0.1',
      },
    })

    console.log(`✅ Successfully prepopulated Exa Search configuration!`)
    console.log(`\n📋 Updated fields:`)
    console.log(`   Command: ${updated.command}`)
    console.log(`   Args: ${updated.args}`)
    console.log(`   Description: ${updated.description?.substring(0, 60)}...`)
    console.log(`   Env: ${updated.env}`)
    console.log(`\n🔑 Next step: Edit the server in the UI and replace 'YOUR_API_KEY_HERE' with your actual Exa API key`)
    console.log(`   Get your API key from: https://dashboard.exa.ai/api-keys`)
    console.log(`\n💡 Note: Exa can also be used as an HTTP server at https://mcp.exa.ai/mcp`)
    console.log(`   If you prefer HTTP mode, you can configure it in the UI as an HTTP server instead.\n`)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

prepopulateExaSearch()
