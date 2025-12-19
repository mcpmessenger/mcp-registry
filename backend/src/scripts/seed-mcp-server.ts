import { registryService } from '../services/registry.service'
import type { MCPTool } from '../types/mcp'

/**
 * Seed script to register the MCP server
 * Run this after migrations to populate the registry
 */

const mcpServer = {
  serverId: 'io.github.mcpmessenger/mcp-server',
  name: 'MCP Server',
  description: 'MCP server for generating and refining SVG designs using AI',
  version: 'v0.1',
  command: 'node',
  args: ['server.js'],
  env: {
    GOOGLE_VISION_API_KEY: process.env.GOOGLE_VISION_API_KEY || '',
    GOOGLE_GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY || '',
  },
  tools: [
    {
      name: 'generate_svg',
      description: 'Generate an SVG from a natural language description. Supports style specifications, color palettes, and size requirements.',
      inputSchema: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Natural language description of the SVG to generate (e.g., "minimalist icon, blue palette")',
          },
          style: {
            type: 'string',
            description: 'Optional style specification (e.g., "minimalist", "modern", "vintage", "playful")',
          },
          colorPalette: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Optional array of color names or hex codes (e.g., ["#0066FF", "#FFFFFF"])',
          },
          size: {
            type: 'object',
            properties: {
              width: {
                type: 'number',
                description: 'Width in pixels',
              },
              height: {
                type: 'number',
                description: 'Height in pixels',
              },
            },
            description: 'Optional size specification (default: 512x512)',
          },
        },
        required: ['description'],
      },
    } as MCPTool,
    {
      name: 'refine_design',
      description: 'Refine an existing design based on iterative instructions. Supports modifications like "make the icon larger", "change the font to serif", or "adjust colors to be more vibrant".',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: {
            type: 'string',
            description: 'The ID of the design job to refine',
          },
          instructions: {
            type: 'string',
            description: 'Natural language instructions for refinement (e.g., "make the icon larger", "change font to serif", "use a warmer color palette")',
          },
        },
        required: ['jobId', 'instructions'],
      },
    } as MCPTool,
  ] as MCPTool[],
  capabilities: ['svg-generation', 'design-refinement', 'ai-powered-design'],
}

async function seed() {
  try {
    console.log('Seeding MCP server...')
    
    // Add a small delay to ensure database is ready
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const server = await registryService.registerServer(mcpServer)
    
    console.log('✅ MCP server registered successfully!')
    console.log(`   Server ID: ${server.serverId}`)
    console.log(`   Name: ${server.name}`)
    console.log(`   Tools: ${server.tools.length}`)
    console.log(`   Capabilities: ${server.capabilities?.join(', ')}`)
  } catch (error: any) {
    if (error?.code === 'P2002' || (error instanceof Error && error.message.includes('Unique constraint'))) {
      console.log('⚠️  MCP server already exists. Skipping...')
    } else if (error?.code === 'P1008') {
      console.error('❌ Database timeout. Please ensure:')
      console.error('   1. No other process is using the database')
      console.error('   2. Delete dev.db-journal if it exists')
      console.error('   3. Try running the seed command again')
      process.exit(1)
    } else {
      console.error('❌ Error seeding MCP server:', error)
      process.exit(1)
    }
  }
}

// Run if called directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log('Seed completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Seed failed:', error)
      process.exit(1)
    })
}

export default seed
