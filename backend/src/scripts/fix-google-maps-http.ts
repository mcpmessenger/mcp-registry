/**
 * Fix Google Maps MCP Server - Convert from STDIO to HTTP
 * 
 * This script updates the existing modelcontextprotocol/google-maps server
 * to use HTTP endpoint instead of STDIO command/args
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixGoogleMapsHttp() {
  console.log('🔧 Fixing Google Maps MCP Server (STDIO → HTTP)...\n')

  try {
    // Find the STDIO version
    const stdioServer = await prisma.mcpServer.findUnique({
      where: { serverId: 'modelcontextprotocol/google-maps' },
    })

    if (!stdioServer) {
      console.log('❌ Server modelcontextprotocol/google-maps not found')
      return
    }

    console.log(`📦 Found server: ${stdioServer.name}`)
    console.log(`   Current type: STDIO (command: ${stdioServer.command}, args: ${stdioServer.args})`)

    // Parse existing metadata
    let metadata: Record<string, unknown> = {}
    if (stdioServer.metadata) {
      try {
        metadata = JSON.parse(stdioServer.metadata)
      } catch (e) {
        console.warn('Failed to parse existing metadata')
      }
    }

    // Update to HTTP server
    const updated = await prisma.mcpServer.update({
      where: { serverId: 'modelcontextprotocol/google-maps' },
      data: {
        // Remove STDIO configuration
        command: null,
        args: null,
        // Update metadata with HTTP endpoint
        metadata: JSON.stringify({
          ...metadata,
          endpoint: 'https://mapstools.googleapis.com/mcp',
          source: 'official',
          publisher: 'Google',
          documentation: 'https://developers.google.com/maps/ai/grounding-lite',
          notes: 'HTTP server. Set HTTP Headers to {"X-Goog-Api-Key":"YOUR_KEY"}',
        }),
        // Update manifest
        manifest: JSON.stringify({
          name: 'Google Maps MCP (Grounding Lite)',
          version: '0.1.0',
          endpoint: 'https://mapstools.googleapis.com/mcp',
          tools: [],
          capabilities: ['tools'],
        }),
        // Clear tools - will be rediscovered via HTTP
        tools: null,
      },
    })

    console.log(`✅ Successfully updated to HTTP server!`)
    console.log(`   Endpoint: https://mapstools.googleapis.com/mcp`)
    console.log(`   Next step: Edit server in UI and add X-Goog-Api-Key in HTTP Headers field`)
    console.log(`   Then click Test button to discover tools\n`)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

fixGoogleMapsHttp()
