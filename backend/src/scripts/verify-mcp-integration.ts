/**
 * Verify MCP Integration Status
 * 
 * Checks integration status for all registered MCP servers and updates their status.
 * Run with: npm run verify-integration
 */

import { registryService } from '../services/registry.service'
import { getBatchIntegrationStatus } from '../services/integration-status.service'
import { prisma } from '../config/database'

async function verifyMCPIntegration() {
  console.log('🔍 Verifying MCP server integration status...\n')

  try {
    // Get all servers from registry
    const servers = await registryService.getServers()
    console.log(`📦 Found ${servers.length} server(s) to verify\n`)

    if (servers.length === 0) {
      console.log('No servers found in registry.')
      return
    }

    // Get integration status for all servers
    console.log('Checking integration status...')
    const statusMap = await getBatchIntegrationStatus(servers)

    let activeCount = 0
    let preIntegrationCount = 0
    let offlineCount = 0

    // Display results and update database
    console.log('\n' + '='.repeat(80))
    console.log('Integration Status Report')
    console.log('='.repeat(80) + '\n')

    for (const server of servers) {
      const statusResult = statusMap.get(server.serverId)
      if (!statusResult) {
        console.log(`⚠️  ${server.name}: Status check failed`)
        continue
      }

      const { status, reason, details } = statusResult

      // Update counts
      if (status === 'active') activeCount++
      else if (status === 'pre-integration') preIntegrationCount++
      else offlineCount++

      // Display status
      const statusIcon = status === 'active' ? '✅' : status === 'pre-integration' ? '⚠️' : '❌'
      console.log(`${statusIcon} ${server.name} (${server.serverId})`)
      console.log(`   Status: ${status.toUpperCase()}`)
      console.log(`   Reason: ${reason}`)
      console.log(`   Tools: ${details.toolsCount} discovered`)
      if (details.packageVerified !== undefined) {
        console.log(`   Package: ${details.packageVerified ? '✅ Verified' : '❌ Not found'}`)
      }
      if (details.healthCheckPassed !== undefined) {
        console.log(`   Health: ${details.healthCheckPassed ? '✅ Passed' : '❌ Failed'}`)
      }
      console.log()

      // Store integration status in metadata (we'll use metadata field for now)
      // In the future, we could add a dedicated integrationStatus field to the schema
      const currentMetadata = server.metadata && typeof server.metadata === 'object'
        ? server.metadata as Record<string, unknown>
        : {}
      
      const updatedMetadata = {
        ...currentMetadata,
        integrationStatus: status,
        integrationReason: reason,
        integrationDetails: details,
        integrationCheckedAt: new Date().toISOString(),
      }

      await prisma.mcpServer.update({
        where: { serverId: server.serverId },
        data: {
          metadata: JSON.stringify(updatedMetadata),
        },
      })
    }

    console.log('='.repeat(80))
    console.log('Summary:')
    console.log(`   ✅ Active: ${activeCount}`)
    console.log(`   ⚠️  Pre-Integration: ${preIntegrationCount}`)
    console.log(`   ❌ Offline: ${offlineCount}`)
    console.log(`   📊 Total: ${servers.length}`)
    console.log('='.repeat(80))
    console.log('\n✨ Integration status verification complete!')
    console.log('   Status information has been stored in server metadata.')

  } catch (error) {
    console.error('❌ Error verifying integration status:', error)
    throw error
  }
}

// Run if executed directly
if (require.main === module) {
  verifyMCPIntegration()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { verifyMCPIntegration }

