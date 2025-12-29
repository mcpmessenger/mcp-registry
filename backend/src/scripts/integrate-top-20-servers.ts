/**
 * Integrate Top 20 MCP Servers
 * 
 * Comprehensive script to:
 * 1. Verify npm packages exist
 * 2. Discover tools for servers with valid packages
 * 3. Update integration status
 * 
 * Run with: npm run integrate-top-20
 */

import { registryService } from '../services/registry.service'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '../config/database'

const execAsync = promisify(exec)

interface ServerManifest {
  id: string
  name: string
  description: string
  command: string
  args: string[]
  env: string[]
  requires_args?: boolean
}

/**
 * Verify if an npm package exists
 */
async function verifyNpmPackage(packageName: string): Promise<{ exists: boolean; version?: string }> {
  try {
    const { stdout } = await execAsync(`npm view ${packageName} version`, {
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    })
    const version = stdout.trim()
    return { exists: true, version }
  } catch (error) {
    return { exists: false }
  }
}

/**
 * Get package name from server args
 */
function getPackageName(args: string[]): string | null {
  if (!args || args.length === 0) return null
  // Last arg is usually the package name
  const lastArg = args[args.length - 1]
  // Skip flags like -y
  if (lastArg.startsWith('-')) return null
  return lastArg
}

async function integrateTop20Servers() {
  console.log('🚀 Integrating Top 20 MCP Servers...\n')

  // Read manifest
  const manifestPath = path.join(__dirname, '../../data/top-20-servers.json')
  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ Manifest file not found: ${manifestPath}`)
    process.exit(1)
  }

  const manifestContent = fs.readFileSync(manifestPath, 'utf-8')
  const servers: ServerManifest[] = JSON.parse(manifestContent)

  console.log(`📦 Processing ${servers.length} servers from manifest\n`)

  let verifiedCount = 0
  let discoveredCount = 0
  let activeCount = 0
  let preIntegrationCount = 0

  for (const server of servers) {
    const orgName = server.id === 'context7' ? 'context7' : 'modelcontextprotocol'
    const serverId = `${orgName}/${server.id}`
    const packageName = getPackageName(server.args)

    console.log(`\n${'='.repeat(60)}`)
    console.log(`📦 ${server.name} (${serverId})`)
    console.log('='.repeat(60))

    // Check if server exists in registry
    const existingServer = await prisma.mcpServer.findUnique({
      where: { serverId },
    })

    if (!existingServer) {
      console.log(`   ⚠️  Server not found in registry, skipping...`)
      preIntegrationCount++
      continue
    }

    // Verify package exists
    if (packageName) {
      console.log(`   🔍 Verifying package: ${packageName}`)
      const packageInfo = await verifyNpmPackage(packageName)
      
      if (packageInfo.exists) {
        console.log(`   ✅ Package verified: ${packageName}@${packageInfo.version}`)
        verifiedCount++

        // Update metadata with package info
        const currentMetadata = existingServer.metadata
          ? JSON.parse(existingServer.metadata)
          : {}
        
        await prisma.mcpServer.update({
          where: { serverId },
          data: {
            metadata: JSON.stringify({
              ...currentMetadata,
              npmPackage: packageName,
              npmVersion: packageInfo.version,
              packageVerified: true,
              packageVerifiedAt: new Date().toISOString(),
            }),
          },
        })

        // Try to discover tools if not already discovered
        const hasTools = existingServer.tools && existingServer.tools.trim() !== '' && existingServer.tools !== '[]'
        
        if (!hasTools) {
          console.log(`   🔍 Attempting tool discovery...`)
          try {
            const discoveredTools = await registryService.discoverToolsForServer(serverId)
            if (discoveredTools && discoveredTools.length > 0) {
              console.log(`   ✅ Discovered ${discoveredTools.length} tools`)
              discoveredCount++
              
              // Update status metadata
              const updatedMetadata = existingServer.metadata
                ? JSON.parse(existingServer.metadata)
                : {}
              
              await prisma.mcpServer.update({
                where: { serverId },
                data: {
                  metadata: JSON.stringify({
                    ...updatedMetadata,
                    integrationStatus: 'active',
                    toolsDiscovered: true,
                    toolsDiscoveredAt: new Date().toISOString(),
                  }),
                },
              })
              activeCount++
            } else {
              console.log(`   ⚠️  No tools discovered`)
              preIntegrationCount++
            }
          } catch (error: any) {
            console.log(`   ⚠️  Tool discovery failed: ${error.message}`)
            preIntegrationCount++
          }
        } else {
          console.log(`   ✅ Tools already discovered`)
          activeCount++
        }
      } else {
        console.log(`   ❌ Package not found: ${packageName}`)
        preIntegrationCount++

        // Update metadata
        const currentMetadata = existingServer.metadata
          ? JSON.parse(existingServer.metadata)
          : {}
        
        await prisma.mcpServer.update({
          where: { serverId },
          data: {
            metadata: JSON.stringify({
              ...currentMetadata,
              npmPackage: packageName,
              packageVerified: false,
              packageVerifiedAt: new Date().toISOString(),
              integrationStatus: 'pre-integration',
              integrationReason: `Package ${packageName} not found on npm`,
            }),
          },
        })
      }
    } else {
      console.log(`   ⚠️  No package name found in args`)
      preIntegrationCount++
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log('✨ Integration Summary')
  console.log('='.repeat(60))
  console.log(`   ✅ Packages Verified: ${verifiedCount}`)
  console.log(`   🔍 Tools Discovered: ${discoveredCount}`)
  console.log(`   ✅ Active Servers: ${activeCount}`)
  console.log(`   ⚠️  Pre-Integration: ${preIntegrationCount}`)
  console.log(`   📊 Total Processed: ${servers.length}`)
  console.log('='.repeat(60))
  console.log('\n💡 Next steps:')
  console.log('   - Run "npm run verify-integration" to check all server statuses')
  console.log('   - Run "npm run test-mcp-servers" to test active servers')
}

// Run if executed directly
if (require.main === module) {
  integrateTop20Servers()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { integrateTop20Servers }

