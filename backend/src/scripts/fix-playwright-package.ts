/**
 * Fix Playwright package name - Update to correct Microsoft package
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixPlaywrightPackage() {
  console.log('🔧 Fixing Playwright package name...\n')

  try {
    const server = await prisma.mcpServer.findUnique({
      where: { serverId: 'modelcontextprotocol/playwright' },
    })

    if (!server) {
      console.log('❌ Server not found')
      return
    }

    console.log(`📦 Found server: ${server.name}`)
    console.log(`   Current args: ${server.args}`)

    // Parse existing metadata
    let metadata: Record<string, unknown> = {}
    if (server.metadata) {
      try {
        metadata = JSON.parse(server.metadata)
      } catch (e) {
        console.warn('Failed to parse existing metadata')
      }
    }

    // Update args to correct package (Microsoft's official package)
    const newArgs = JSON.stringify(['-y', '@playwright/mcp@latest'])
    
    // Update metadata
    metadata.npmPackage = '@playwright/mcp'
    metadata.publisher = 'Microsoft'
    metadata.documentation = 'https://github.com/microsoft/playwright-mcp'
    metadata.repository = 'https://github.com/microsoft/playwright-mcp'

    const updated = await prisma.mcpServer.update({
      where: { serverId: 'modelcontextprotocol/playwright' },
      data: {
        args: newArgs,
        metadata: JSON.stringify(metadata),
        description: 'Official Microsoft Playwright MCP server for browser automation. Enables LLMs to interact with web pages through Playwright for navigation, element interaction, screenshots, and DOM inspection.',
      },
    })

    console.log(`✅ Successfully updated!`)
    console.log(`   New args: ${updated.args}`)
    console.log(`   Package: @playwright/mcp@latest (Microsoft's official package)`)
    console.log(`   Next: Refresh the UI and try again\n`)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

fixPlaywrightPackage()
