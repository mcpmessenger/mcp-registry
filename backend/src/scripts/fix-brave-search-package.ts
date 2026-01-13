/**
 * Prepopulate Brave Search MCP Server - Set all fields except API key
 * 
 * This script updates the existing modelcontextprotocol/brave-search server
 * with correct configuration: package name, command, args, description, metadata
 * The user will need to add BRAVE_API_KEY in the env field via UI
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function prepopulateBraveSearch() {
  console.log('🔧 Prepopulating Brave Search MCP Server configuration...\n')

  try {
    // Find the existing server
    const existingServer = await prisma.mcpServer.findUnique({
      where: { serverId: 'modelcontextprotocol/brave-search' },
    })

    if (!existingServer) {
      console.log('❌ Server modelcontextprotocol/brave-search not found')
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
      publisher: 'Brave',
      verified: true,
      requiresEnv: true,
      envVars: ['BRAVE_API_KEY'],
      npmPackage: '@brave/brave-search-mcp-server',
      documentation: 'https://github.com/brave/brave-search-mcp-server',
    }

    // Set env with placeholder (user will replace with real key)
    const env = {
      BRAVE_API_KEY: 'YOUR_API_KEY_HERE',
    }

    // Update server with all fields
    const updated = await prisma.mcpServer.update({
      where: { serverId: 'modelcontextprotocol/brave-search' },
      data: {
        name: 'Brave Search',
        description: 'Web search via Brave API. Supports web search, image search, video search, news search, and AI-powered summarization.',
        command: 'npx',
        args: JSON.stringify(['-y', '@brave/brave-search-mcp-server']),
        env: JSON.stringify(env),
        metadata: JSON.stringify(metadata),
        version: 'v0.1',
      },
    })

    console.log(`✅ Successfully prepopulated Brave Search configuration!`)
    console.log(`\n📋 Updated fields:`)
    console.log(`   Command: ${updated.command}`)
    console.log(`   Args: ${updated.args}`)
    console.log(`   Description: ${updated.description?.substring(0, 60)}...`)
    console.log(`   Env: ${updated.env}`)
    console.log(`\n🔑 Next step: Edit the server in the UI and replace 'YOUR_API_KEY_HERE' with your actual Brave Search API key`)
    console.log(`   Get your API key from: https://api.search.brave.com/\n`)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

prepopulateBraveSearch()
