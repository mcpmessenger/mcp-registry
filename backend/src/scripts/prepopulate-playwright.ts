/**
 * Prepopulate Playwright MCP Server - Set all fields
 * 
 * This script updates the existing modelcontextprotocol/playwright server
 * with correct configuration: package name, command, args, description, metadata
 * 
 * Note: Playwright doesn't require API keys, so no env vars needed
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function prepopulatePlaywright() {
  console.log('🔧 Prepopulating Playwright MCP Server configuration...\n')

  try {
    // Find the existing server
    const existingServer = await prisma.mcpServer.findUnique({
      where: { serverId: 'modelcontextprotocol/playwright' },
    })

    if (!existingServer) {
      console.log('❌ Server modelcontextprotocol/playwright not found')
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
      publisher: 'Microsoft',
      verified: true,
      requiresEnv: false,
      npmPackage: '@playwright/mcp',
      documentation: 'https://github.com/microsoft/playwright-mcp',
      repository: 'https://github.com/microsoft/playwright-mcp',
    }

    // Update server with all fields (no env vars needed for Playwright)
    const updated = await prisma.mcpServer.update({
      where: { serverId: 'modelcontextprotocol/playwright' },
      data: {
        name: 'Playwright',
        description: 'Official Microsoft Playwright MCP server for browser automation. Enables LLMs to interact with web pages through Playwright for navigation, element interaction, screenshots, and DOM inspection.',
        command: 'npx',
        args: JSON.stringify(['-y', '@playwright/mcp@latest']),
        env: JSON.stringify({}), // No environment variables needed
        metadata: JSON.stringify(metadata),
        version: 'v0.1',
      },
    })

    console.log(`✅ Successfully prepopulated Playwright configuration!`)
    console.log(`\n📋 Updated fields:`)
    console.log(`   Command: ${updated.command}`)
    console.log(`   Args: ${updated.args}`)
    console.log(`   Description: ${updated.description?.substring(0, 60)}...`)
    console.log(`   Env: ${updated.env}`)
    console.log(`\n💡 Note: Playwright doesn't require API keys or environment variables.`)
    console.log(`   The package should be available via npx automatically.\n`)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

prepopulatePlaywright()
