/**
 * Prepopulate Filesystem MCP Server Configuration
 * 
 * This script configures the Filesystem MCP server with allowed directory paths.
 * The Filesystem server requires directory paths to be specified as arguments
 * for security (it only allows access to specified directories).
 */

import { PrismaClient } from '@prisma/client'
import * as path from 'path'
import * as os from 'os'

const prisma = new PrismaClient()

async function prepopulateFilesystem() {
  try {
    console.log('[Prepopulate Filesystem] Starting...')

    // Get the project root directory (assuming this script runs from backend/)
    const projectRoot = path.resolve(__dirname, '../..')
    const backendDir = path.resolve(__dirname, '..')
    
    // Default allowed directories
    // You can customize these based on your needs
    const allowedDirectories = [
      projectRoot,           // Project root - allows access to entire project
      // Uncomment and customize these as needed:
      // path.join(projectRoot, 'backend'),  // Just backend directory
      // path.join(projectRoot, 'app'),      // Just app directory
      // os.homedir(),                       // User home directory (use with caution!)
    ]

    // Convert Windows paths to forward slashes if needed (npx handles both)
    const normalizedPaths = allowedDirectories.map(dir => {
      // On Windows, convert backslashes to forward slashes for consistency
      return dir.replace(/\\/g, '/')
    })

    // Build args array: npx command + package + directory paths
    const args = [
      '-y',
      '@modelcontextprotocol/server-filesystem',
      ...normalizedPaths
    ]

    // Find the Filesystem server
    const server = await prisma.mcpServer.findUnique({
      where: { serverId: 'modelcontextprotocol/filesystem' }
    })

    if (!server) {
      console.error('[Prepopulate Filesystem] Server not found. Make sure it\'s registered first.')
      console.log('[Prepopulate Filesystem] Run: npm run register-top-20')
      process.exit(1)
    }

    console.log(`[Prepopulate Filesystem] Found server: ${server.name}`)
    console.log(`[Prepopulate Filesystem] Allowed directories:`)
    normalizedPaths.forEach(dir => console.log(`  - ${dir}`))

    // Update the server with directory paths
    const updated = await prisma.mcpServer.update({
      where: { serverId: 'modelcontextprotocol/filesystem' },
      data: {
        args: JSON.stringify(args),
        description: `Local file system access. Allowed directories: ${normalizedPaths.join(', ')}`,
        metadata: {
          ...(server.metadata && typeof server.metadata === 'object' ? server.metadata : {}),
          allowedDirectories: normalizedPaths,
          configured: true,
        },
      },
    })

    console.log('[Prepopulate Filesystem] ✅ Successfully configured Filesystem server!')
    console.log(`[Prepopulate Filesystem] Args: ${JSON.stringify(args, null, 2)}`)
    console.log('\n[Prepopulate Filesystem] Next steps:')
    console.log('1. Run tool discovery: npm run integrate-top-20')
    console.log('2. Test the server in the chat or registry UI')
    console.log('3. Try: "List files in the project root" or "Read package.json"')

  } catch (error) {
    console.error('[Prepopulate Filesystem] Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run if executed directly
if (require.main === module) {
  prepopulateFilesystem()
    .then(() => {
      console.log('[Prepopulate Filesystem] Done!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('[Prepopulate Filesystem] Failed:', error)
      process.exit(1)
    })
}

export { prepopulateFilesystem }
