/**
 * Update Exa Search API Key
 * 
 * This script updates the EXA_API_KEY for the Exa Search MCP server
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const EXA_API_KEY = 'b95fd5a8-330d-488f-9fbf-4db3c3507ea3'

async function updateExaApiKey() {
  console.log('🔑 Updating Exa Search API Key...\n')

  try {
    // Find the existing server
    const existingServer = await prisma.mcpServer.findUnique({
      where: { serverId: 'modelcontextprotocol/exa' },
    })

    if (!existingServer) {
      console.log('❌ Server modelcontextprotocol/exa not found')
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
    env.EXA_API_KEY = EXA_API_KEY

    // Update server
    const updated = await prisma.mcpServer.update({
      where: { serverId: 'modelcontextprotocol/exa' },
      data: {
        env: JSON.stringify(env),
      },
    })

    console.log(`✅ Successfully updated Exa Search API key!`)
    console.log(`   API Key: ${EXA_API_KEY.substring(0, 10)}...`)
    console.log(`   Full env: ${updated.env}`)
    console.log(`\n🎉 The server is now configured with your API key.`)
    console.log(`   Try testing the server or using /exa-search in the chat.\n`)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

updateExaApiKey()
