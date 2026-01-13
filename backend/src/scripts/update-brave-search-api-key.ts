/**
 * Update Brave Search API Key
 * 
 * This script updates the BRAVE_API_KEY for the Brave Search MCP server
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BRAVE_API_KEY = 'BSAj8o0XXQHoNk62znZdHVE6mPGApW9'

async function updateBraveSearchApiKey() {
  console.log('🔑 Updating Brave Search API Key...\n')

  try {
    // Find the existing server
    const existingServer = await prisma.mcpServer.findUnique({
      where: { serverId: 'modelcontextprotocol/brave-search' },
    })

    if (!existingServer) {
      console.log('❌ Server modelcontextprotocol/brave-search not found')
      return
    }

    console.log(`📦 Found server: ${existingServer.name}`)

    // Parse existing env (stored as JSON string in database)
    let env: Record<string, string> = {}
    if (existingServer.env) {
      try {
        env = JSON.parse(existingServer.env)
      } catch (e) {
        console.warn('Failed to parse existing env, will create new')
      }
    }

    // Update the API key
    env.BRAVE_API_KEY = BRAVE_API_KEY

    // Update server
    const updated = await prisma.mcpServer.update({
      where: { serverId: 'modelcontextprotocol/brave-search' },
      data: {
        env: JSON.stringify(env),
      },
    })

    console.log(`✅ Successfully updated Brave Search API key!`)
    console.log(`   API Key: ${BRAVE_API_KEY.substring(0, 10)}...`)
    console.log(`   Full env: ${updated.env}`)
    console.log(`\n🎉 The server is now configured with your API key.`)
    console.log(`   Try testing the server or waiting for tool discovery to complete.\n`)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

updateBraveSearchApiKey()
