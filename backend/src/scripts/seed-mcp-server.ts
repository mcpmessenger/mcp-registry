import { registerOfficialServers } from './register-official-servers'
import { registerValuationServer } from './register-valuation-server'

/**
 * Master seed script to register all stock MCP servers
 * 
 * This script registers all default/stock servers that should be available
 * in the registry by default:
 * - Official servers (Playwright, LangChain Agent, Google Maps MCP)
 * - Valuation MCP Server
 * 
 * Run this after database migrations or when stock servers are missing:
 *   npm run seed
 *   or
 *   ts-node src/scripts/seed-mcp-server.ts
 */

async function seedAllStockServers() {
  console.log('🌱 Seeding all stock MCP servers...\n')
  console.log('='.repeat(60))
  console.log()

  try {
    // Register official servers (Playwright, LangChain, Google Maps)
    await registerOfficialServers()
    
    console.log()
    console.log('='.repeat(60))
    console.log()

    // Register valuation server
    await registerValuationServer()

    console.log()
    console.log('='.repeat(60))
    console.log('✨ All stock servers seeded successfully!')
    console.log('='.repeat(60))
  } catch (error) {
    console.error('❌ Error seeding stock servers:', error)
    throw error
  }
}

// Run if executed directly
if (require.main === module) {
  seedAllStockServers()
    .then(() => {
      console.log('\n✅ Seed complete')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Seed failed:', error)
      process.exit(1)
    })
}

export { seedAllStockServers }

