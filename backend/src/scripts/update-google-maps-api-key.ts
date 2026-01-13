/**
 * Update Google Maps MCP Server API Key
 * 
 * This script updates the HTTP headers for Google Maps MCP server with a new API key
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateGoogleMapsApiKey() {
  const newApiKey = process.argv[2] || 'AIzaSyAfAqQmWuRR3QYfzzm7TGb4e25Je5X0fEo'
  
  console.log('🔑 Updating Google Maps MCP Server API Key...\n')
  console.log(`   New API Key: ${newApiKey.substring(0, 10)}...\n`)

  try {
    // Try to find Google Maps server (could be either serverId)
    const serverIds = [
      'modelcontextprotocol/google-maps',
      'com.google/maps-mcp',
    ]

    let server = null
    for (const serverId of serverIds) {
      server = await prisma.mcpServer.findUnique({
        where: { serverId },
      })
      if (server) {
        console.log(`📦 Found server: ${server.name} (${serverId})`)
        break
      }
    }

    if (!server) {
      console.log('❌ Google Maps server not found. Tried:')
      serverIds.forEach(id => console.log(`   - ${id}`))
      return
    }

    // Parse existing metadata
    let metadata: Record<string, unknown> = {}
    if (server.metadata) {
      try {
        metadata = JSON.parse(server.metadata)
      } catch (e) {
        console.warn('Failed to parse existing metadata, starting fresh')
      }
    }

    // Update HTTP headers
    metadata.httpHeaders = {
      'X-Goog-Api-Key': newApiKey,
    }

    // Update server
    const updated = await prisma.mcpServer.update({
      where: { serverId: server.serverId },
      data: {
        metadata: JSON.stringify(metadata),
        // Clear tools - will be rediscovered with new API key
        tools: null,
      },
    })

    console.log(`✅ Successfully updated API key!`)
    console.log(`   Server: ${updated.name}`)
    console.log(`   Next step: Click "Test" button in the UI to verify and discover tools\n`)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

updateGoogleMapsApiKey()
