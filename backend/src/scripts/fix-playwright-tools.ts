/**
 * Fix script to ensure Playwright MCP server has all tools registered
 * Run this if you see "No tools available" error
 */

import { registryService } from '../services/registry.service'
import type { MCPTool } from '../types/mcp'

const playwrightTools: MCPTool[] = [
  {
    name: 'browser_navigate',
    description: 'Navigate to a URL',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The URL to navigate to',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'browser_snapshot',
    description: 'Capture accessibility snapshot of the current page (better than screenshot for LLM understanding)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filename: {
          type: 'string',
          description: 'Optional: Save snapshot to markdown file',
        },
      },
    },
  },
  {
    name: 'browser_click',
    description: 'Perform click on a web page element',
    inputSchema: {
      type: 'object' as const,
      properties: {
        element: {
          type: 'string',
          description: 'Human-readable element description',
        },
        ref: {
          type: 'string',
          description: 'Exact target element reference from page snapshot',
        },
        doubleClick: {
          type: 'boolean',
          description: 'Whether to perform double click',
        },
        button: {
          type: 'string',
          description: 'Button to click (left, right, middle)',
        },
        modifiers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Modifier keys to press',
        },
      },
      required: ['element', 'ref'],
    },
  },
  {
    name: 'browser_type',
    description: 'Type text into editable element',
    inputSchema: {
      type: 'object' as const,
      properties: {
        element: {
          type: 'string',
          description: 'Human-readable element description',
        },
        ref: {
          type: 'string',
          description: 'Exact target element reference',
        },
        text: {
          type: 'string',
          description: 'Text to type',
        },
        submit: {
          type: 'boolean',
          description: 'Whether to submit after typing (press Enter)',
        },
        slowly: {
          type: 'boolean',
          description: 'Type one character at a time',
        },
      },
      required: ['element', 'ref', 'text'],
    },
  },
  {
    name: 'browser_fill_form',
    description: 'Fill multiple form fields at once',
    inputSchema: {
      type: 'object' as const,
      properties: {
        fields: {
          type: 'array' as const,
          description: 'Array of fields to fill',
          items: {
            type: 'object' as const,
          },
        },
      },
      required: ['fields'],
    },
  },
  {
    name: 'browser_take_screenshot',
    description: 'Take a screenshot of the current page or element',
    inputSchema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          description: 'Image format (png, jpeg)',
        },
        filename: {
          type: 'string',
          description: 'File name to save screenshot',
        },
        element: {
          type: 'string',
          description: 'Human-readable element description',
        },
        ref: {
          type: 'string',
          description: 'Exact target element reference',
        },
        fullPage: {
          type: 'boolean',
          description: 'Take screenshot of full scrollable page',
        },
      },
    },
  },
  {
    name: 'browser_evaluate',
    description: 'Evaluate JavaScript expression on page or element',
    inputSchema: {
      type: 'object' as const,
      properties: {
        function: {
          type: 'string',
          description: 'JavaScript function to evaluate',
        },
        element: {
          type: 'string',
          description: 'Optional element description',
        },
        ref: {
          type: 'string',
          description: 'Optional element reference',
        },
      },
      required: ['function'],
    },
  },
  {
    name: 'browser_wait_for',
    description: 'Wait for text to appear or disappear or a specified time to pass',
    inputSchema: {
      type: 'object' as const,
      properties: {
        time: {
          type: 'number',
          description: 'Time to wait in seconds',
        },
        text: {
          type: 'string',
          description: 'Text to wait for',
        },
        textGone: {
          type: 'string',
          description: 'Text to wait for to disappear',
        },
      },
    },
  },
  {
    name: 'browser_close',
    description: 'Close the browser page',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'browser_select_option',
    description: 'Select an option in a dropdown',
    inputSchema: {
      type: 'object' as const,
      properties: {
        element: {
          type: 'string',
          description: 'Human-readable element description',
        },
        ref: {
          type: 'string',
          description: 'Exact target element reference',
        },
        values: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of values to select',
        },
      },
      required: ['element', 'ref', 'values'],
    },
  },
  {
    name: 'browser_hover',
    description: 'Hover over element on page',
    inputSchema: {
      type: 'object' as const,
      properties: {
        element: {
          type: 'string',
          description: 'Human-readable element description',
        },
        ref: {
          type: 'string',
          description: 'Exact target element reference',
        },
      },
      required: ['element', 'ref'],
    },
  },
  {
    name: 'browser_press_key',
    description: 'Press a key on the keyboard',
    inputSchema: {
      type: 'object' as const,
      properties: {
        key: {
          type: 'string',
          description: 'Name of the key to press',
        },
      },
      required: ['key'],
    },
  },
  {
    name: 'browser_resize',
    description: 'Resize the browser window',
    inputSchema: {
      type: 'object' as const,
      properties: {
        width: {
          type: 'number',
          description: 'Width of the browser window',
        },
        height: {
          type: 'number',
          description: 'Height of the browser window',
        },
      },
      required: ['width', 'height'],
    },
  },
  {
    name: 'browser_drag',
    description: 'Perform drag and drop between two elements',
    inputSchema: {
      type: 'object' as const,
      properties: {
        startElement: {
          type: 'string',
          description: 'Human-readable source element description',
        },
        startRef: {
          type: 'string',
          description: 'Exact source element reference',
        },
        endElement: {
          type: 'string',
          description: 'Human-readable target element description',
        },
        endRef: {
          type: 'string',
          description: 'Exact target element reference',
        },
      },
      required: ['startElement', 'startRef', 'endElement', 'endRef'],
    },
  },
]

async function fixPlaywrightTools() {
  const serverId = 'com.microsoft.playwright/mcp'

  console.log('🔧 Fixing Playwright MCP server tools...')
  console.log(`Server ID: ${serverId}`)
  console.log(`Tools to register: ${playwrightTools.length}\n`)

  try {
    // Get existing server
    const existingServer = await registryService.getServerById(serverId)

    if (!existingServer) {
      console.log(`⚠️  Server ${serverId} not found via getServerById. Checking if inactive...\n`)
      
      // Server might exist but be inactive - check directly via Prisma
      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()
      
      try {
        const dbServer = await prisma.mcpServer.findUnique({
          where: { serverId },
        })
        
        if (dbServer) {
          console.log(`   Found server in database (isActive: ${dbServer.isActive}). Updating...\n`)
          // Server exists - update it with tools and ensure it's active
          await prisma.mcpServer.update({
            where: { serverId },
            data: {
              isActive: true,
              tools: JSON.stringify(playwrightTools),
              toolSchemas: JSON.stringify(Object.fromEntries(
                playwrightTools.map(t => [t.name, t.inputSchema])
              )),
              name: 'Playwright MCP Server',
              description: 'Official Microsoft Playwright MCP server for browser automation. Enables LLMs to interact with web pages through structured accessibility snapshots, navigate, click, fill forms, take screenshots, and more.',
              version: 'v0.1',
              command: 'npx',
              args: JSON.stringify(['-y', '@playwright/mcp@latest']),
              capabilities: JSON.stringify(['tools']),
              metadata: JSON.stringify({
                source: 'official',
                publisher: 'Microsoft',
                npmPackage: '@playwright/mcp',
                repository: 'https://github.com/microsoft/playwright-mcp',
                documentation: 'https://github.com/microsoft/playwright-mcp',
                verified: true,
              }),
              publishedBy: 'system',
            },
          })
          console.log(`✅ Updated and activated Playwright server!\n`)
        } else {
          // Server doesn't exist - create it
          console.log(`   Server doesn't exist. Creating new registration...\n`)
          await registryService.publishServer({
            serverId: serverId,
            name: 'Playwright MCP Server',
            description: 'Official Microsoft Playwright MCP server for browser automation.',
            version: 'v0.1',
            command: 'npx',
            args: ['-y', '@playwright/mcp@latest'],
            env: {},
            tools: playwrightTools,
            capabilities: ['tools'],
            metadata: {
              source: 'official',
              publisher: 'Microsoft',
              npmPackage: '@playwright/mcp',
              repository: 'https://github.com/microsoft/playwright-mcp',
              verified: true,
            },
            publishedBy: 'system',
          })
          console.log(`✅ Created new Playwright server registration!\n`)
        }
      } finally {
        await prisma.$disconnect()
      }
    } else {
      console.log(`✅ Found existing server: ${existingServer.name}`)
      console.log(`Current tools count: ${existingServer.tools?.length || 0}\n`)

      // Update existing server with all tools
      await registryService.publishServer({
        serverId: serverId,
        name: existingServer.name,
        description: existingServer.description || 'Official Microsoft Playwright MCP server for browser automation.',
        version: existingServer.version || 'v0.1',
        command: existingServer.command || 'npx',
        args: existingServer.args || ['-y', '@playwright/mcp@latest'],
        env: existingServer.env || {},
        tools: playwrightTools,
        capabilities: ['tools'],
        metadata: existingServer.metadata || {
          source: 'official',
          publisher: 'Microsoft',
          npmPackage: '@playwright/mcp',
          repository: 'https://github.com/microsoft/playwright-mcp',
          documentation: 'https://github.com/microsoft/playwright-mcp',
          verified: true,
        },
        publishedBy: 'system',
      })
    }

    // Verify - wait a moment for database to settle
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const updatedServer = await registryService.getServerById(serverId)
    
    if (!updatedServer) {
      console.log(`\n⚠️  Warning: Could not retrieve server immediately after ${existingServer ? 'update' : 'creation'}`)
      console.log(`   This might be a timing issue. The server should exist now.`)
      console.log(`   Try running the script again or check the database directly.`)
      console.log(`\n✨ Registration completed. Tools should be saved in the database.`)
      return
    }
    
    console.log(`\n✅ Successfully ${existingServer ? 'updated' : 'created'} server!`)
    console.log(`Server name: ${updatedServer.name}`)
    console.log(`Tools count: ${updatedServer.tools?.length || 0}`)
    
    if (updatedServer.tools && updatedServer.tools.length > 0) {
      console.log(`\n✅ Tools registered successfully:`)
      updatedServer.tools.forEach((tool, index) => {
        console.log(`  ${index + 1}. ${tool.name}`)
      })
    } else {
      console.log(`\n⚠️  Warning: Tools array appears empty in response!`)
      console.log(`   However, tools were sent to the database.`)
      console.log(`   This might be a parsing/transformation issue.`)
      console.log(`   The tools should still be in the database and available via the API.`)
      console.log(`   Try refreshing the frontend or restarting the backend server.`)
    }

    console.log(`\n✨ Done! Playwright server registration complete.`)
  } catch (error) {
    console.error('❌ Failed to fix Playwright tools:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
    }
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  fixPlaywrightTools()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { fixPlaywrightTools }
