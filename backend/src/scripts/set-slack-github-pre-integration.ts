/**
 * Set Slack, GitHub, and GitLab to pre-integration status
 * 
 * This script explicitly sets the integrationStatus in metadata to 'pre-integration'
 * for Slack, GitHub, and GitLab servers, overriding the automatic status detection
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function setSlackGitHubPreIntegration() {
  console.log('🔧 Setting Slack, GitHub, and GitLab to pre-integration status...\n')

  const serverIds = [
    'modelcontextprotocol/slack',
    'modelcontextprotocol/github',
    'modelcontextprotocol/gitlab',
  ]

  for (const serverId of serverIds) {
    try {
      const server = await prisma.mcpServer.findUnique({
        where: { serverId },
      })

      if (!server) {
        console.log(`⚠️  Server ${serverId} not found, skipping`)
        continue
      }

      console.log(`📦 Found server: ${server.name}`)

      // Parse existing metadata
      let metadata: Record<string, unknown> = {}
      if (server.metadata) {
        try {
          metadata = JSON.parse(server.metadata)
        } catch (e) {
          console.warn(`   Failed to parse existing metadata for ${serverId}`)
        }
      }

      // Set integrationStatus to pre-integration
      metadata.integrationStatus = 'pre-integration'

      // Update server
      const updated = await prisma.mcpServer.update({
        where: { serverId },
        data: {
          metadata: JSON.stringify(metadata),
        },
      })

      console.log(`   ✅ Updated ${server.name} to pre-integration status`)

    } catch (error: any) {
      console.error(`   ❌ Error updating ${serverId}:`, error.message)
    }
  }

  console.log(`\n✅ Done! Slack, GitHub, and GitLab are now set to pre-integration status.`)
  console.log(`   Refresh the UI to see the changes.\n`)

  await prisma.$disconnect()
}

setSlackGitHubPreIntegration()
