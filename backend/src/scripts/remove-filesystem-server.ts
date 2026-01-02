/**
 * Remove Filesystem MCP Server from Database
 * 
 * This script removes the Filesystem server from the registry database
 * since it's been removed from the manifest (redundant with document upload).
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function removeFilesystemServer() {
  try {
    console.log('[Remove Filesystem] Starting...')

    const serverId = 'modelcontextprotocol/filesystem'

    // Check if server exists
    const existingServer = await prisma.mcpServer.findUnique({
      where: { serverId },
    })

    if (!existingServer) {
      console.log(`[Remove Filesystem] Server ${serverId} not found in database.`)
      console.log('[Remove Filesystem] Nothing to remove.')
      return
    }

    console.log(`[Remove Filesystem] Found server: ${existingServer.name}`)
    console.log(`[Remove Filesystem] Removing from database...`)

    // Delete the server
    await prisma.mcpServer.delete({
      where: { serverId },
    })

    console.log('[Remove Filesystem] ✅ Successfully removed Filesystem server from database!')
    console.log('[Remove Filesystem] The server will no longer appear in the registry.')

  } catch (error) {
    console.error('[Remove Filesystem] Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run if executed directly
if (require.main === module) {
  removeFilesystemServer()
    .then(() => {
      console.log('[Remove Filesystem] Done!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('[Remove Filesystem] Failed:', error)
      process.exit(1)
    })
}

export { removeFilesystemServer }
