/**
 * Script to update Playwright server from STDIO to HTTP mode
 * Usage: ts-node src/scripts/update-playwright-to-http.ts <endpoint-url>
 * Example: ts-node src/scripts/update-playwright-to-http.ts http://localhost:8931/mcp
 */

import { registryService } from '../services/registry.service'

const serverId = 'com.microsoft.playwright/mcp'

async function updatePlaywrightToHttp(endpointUrl: string) {
  if (!endpointUrl) {
    console.error('❌ Error: Endpoint URL is required')
    console.log('Usage: ts-node src/scripts/update-playwright-to-http.ts <endpoint-url>')
    console.log('Example: ts-node src/scripts/update-playwright-to-http.ts http://localhost:8931/mcp')
    process.exit(1)
  }

  // Validate URL format
  try {
    new URL(endpointUrl)
  } catch (error) {
    console.error('❌ Error: Invalid URL format')
    console.error('   URL should be like: http://localhost:8931/mcp or https://your-service.com/mcp')
    process.exit(1)
  }

  console.log('🔄 Updating Playwright server to HTTP mode...')
  console.log(`Server ID: ${serverId}`)
  console.log(`Endpoint: ${endpointUrl}\n`)

  try {
    // Get existing server
    const existingServer = await registryService.getServerById(serverId)

    if (!existingServer) {
      console.error(`❌ Server ${serverId} not found.`)
      console.log('   Please run: npm run fix-playwright')
      console.log('   This will create the Playwright server registration.')
      process.exit(1)
    }

    console.log(`✅ Found server: ${existingServer.name}`)
    console.log(`Current mode: ${existingServer.command ? 'STDIO' : 'HTTP'}`)
    console.log(`Current endpoint: ${existingServer.metadata?.endpoint || 'None'}\n`)

    // Update to HTTP mode
    await registryService.publishServer({
      serverId: serverId,
      name: existingServer.name,
      description: existingServer.description,
      version: existingServer.version,
      // Remove command/args for HTTP mode
      command: undefined,
      args: undefined,
      env: existingServer.env,
      tools: existingServer.tools, // Keep existing tools
      capabilities: existingServer.capabilities,
      metadata: {
        ...existingServer.metadata,
        endpoint: endpointUrl, // Set HTTP endpoint
      },
      publishedBy: 'system',
    })

    // Verify
    const updatedServer = await registryService.getServerById(serverId)
    if (!updatedServer) {
      throw new Error('Failed to retrieve updated server')
    }

    console.log(`\n✅ Successfully updated to HTTP mode!`)
    console.log(`Endpoint: ${updatedServer.metadata?.endpoint}`)
    console.log(`Mode: ${updatedServer.command ? 'STDIO' : 'HTTP'}`)
    console.log(`\n✨ Done! The Playwright server is now using HTTP mode.`)
    console.log(`\nNext steps:`)
    console.log(`1. Restart your backend server (if running)`)
    console.log(`2. Refresh your frontend`)
    console.log(`3. Test Playwright in the chat interface`)

  } catch (error) {
    console.error('❌ Failed to update Playwright server:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
    }
    process.exit(1)
  }
}

// Get endpoint URL from command line args
const endpointUrl = process.argv[2]

// Run
updatePlaywrightToHttp(endpointUrl)
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
