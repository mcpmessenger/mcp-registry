import { registryService } from '../services/registry.service'
import type { MCPTool } from '../types/mcp'

/**
 * Register official MCP servers in the registry
 * 
 * This script registers well-known, official MCP servers from:
 * - Microsoft (@playwright/mcp)
 * - Google (official MCP servers)
 * - Other trusted sources
 */

// Microsoft Playwright MCP Server
// Use HTTP mode - deployed Playwright MCP HTTP server from mcpmessenger/playwright-mcp
const playwrightHttpEndpoint = process.env.PLAYWRIGHT_HTTP_ENDPOINT || 'https://playwright-mcp-http-server-554655392699.us-central1.run.app/mcp'
const playwrightServer = {
  serverId: 'com.microsoft.playwright/mcp',
  name: 'Playwright MCP Server',
  description: 'Official Microsoft Playwright MCP server for browser automation. Enables LLMs to interact with web pages through structured accessibility snapshots, navigate, click, fill forms, take screenshots, and more.',
  version: 'v0.1',
  // Use HTTP mode by default (no command/args)
  command: undefined,
  args: undefined,
  env: {},
  tools: [
    {
      name: 'browser_navigate',
      description: 'Navigate to a URL',
      inputSchema: {
        type: 'object',
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
        type: 'object',
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
        type: 'object',
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
        },
        required: ['element', 'ref'],
      },
    },
    {
      name: 'browser_type',
      description: 'Type text into editable element',
      inputSchema: {
        type: 'object',
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
        },
        required: ['element', 'ref', 'text'],
      },
    },
    {
      name: 'browser_fill_form',
      description: 'Fill multiple form fields at once',
      inputSchema: {
        type: 'object',
        properties: {
          fields: {
            type: 'array',
            description: 'Array of fields to fill',
            items: {
              type: 'object',
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
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'Image format (png, jpeg)',
          },
          filename: {
            type: 'string',
            description: 'File name to save screenshot',
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
        type: 'object',
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
  ] as MCPTool[],
  capabilities: ['tools'],
    metadata: {
      source: 'official',
      publisher: 'Microsoft',
      npmPackage: '@playwright/mcp',
      repository: 'https://github.com/microsoft/playwright-mcp',
      documentation: 'https://github.com/microsoft/playwright-mcp',
      verified: true,
      endpoint: playwrightHttpEndpoint, // HTTP endpoint for Playwright server
    },
}

// LangChain Agent MCP Server (local/managed LangChain stack)
// Uses custom API format: /mcp/invoke endpoint (not standard MCP JSON-RPC)
const langchainAgentServer = {
  serverId: 'com.langchain/agent-mcp-server',
  name: 'LangChain Agent MCP Server',
  description: 'LangChain Agent MCP Server hosted on Google Cloud Run (langchain-agent-mcp-server-554655392699.us-central1.run.app).',
  version: '1.0.0',
  // Use HTTP mode (no command/args)
  command: undefined as string | undefined,
  args: undefined as string[] | undefined,
  env: {},
  tools: [
    {
      name: 'agent_executor',
      description: 'Execute a complex, multi-step reasoning task...',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: "The user's query or task",
          },
        },
        required: ['query'],
      },
    },
  ] as MCPTool[],
  capabilities: ['tools'],
  manifest: {
    name: 'langchain-agent-mcp-server',
    version: '1.0.0',
    tools: [
      {
        name: 'agent_executor',
        description: 'Execute a complex, multi-step reasoning task...',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: "The user's query or task",
            },
          },
          required: ['query'],
        },
      },
    ],
  },
  metadata: {
    source: 'official',
    publisher: 'LangChainMCP',
    documentation: 'https://github.com/mcpmessenger/LangchainMCP',
    endpoint: 'https://langchain-agent-mcp-server-554655392699.us-central1.run.app/mcp/invoke', // Uses /mcp/invoke endpoint (not standard JSON-RPC)
    verified: true,
    apiFormat: 'custom', // Uses custom API format, not standard MCP JSON-RPC
  },
}

// Google Maps MCP (Grounding Lite over HTTP)
const googleMapsMcpServer = {
  serverId: 'com.google/maps-mcp',
  name: 'Google Maps MCP (Grounding Lite)',
  description: 'Google Maps Platform MCP server (Grounding Lite). Requires X-Goog-Api-Key header configured in the registry HTTP headers.',
  version: '0.1.0',
  command: undefined as string | undefined,
  args: undefined as string[] | undefined,
  env: {},
  tools: [
    {
      name: 'search_places',
      description: 'Search places by text query',
      inputSchema: {
        type: 'object',
        properties: {
          text_query: {
            type: 'string',
            description: 'Primary search text, e.g., tacos in des moines',
          },
          location_bias: {
            type: 'object',
            description: 'Optional bias region (see Maps Grounding Lite docs)',
          },
        },
        required: ['text_query'],
      },
    },
  ] as MCPTool[],
  capabilities: ['tools'],
  manifest: {
    name: 'Google Maps MCP',
    version: '0.1.0',
    endpoint: 'https://mapstools.googleapis.com/mcp',
    tools: [
      {
        name: 'search_places',
        description: 'Search places by text query',
        inputSchema: {
          type: 'object',
          properties: {
            text_query: {
              type: 'string',
              description: 'Primary search text, e.g., tacos in des moines',
            },
            location_bias: {
              type: 'object',
              description: 'Optional bias region (see Maps Grounding Lite docs)',
            },
          },
          required: ['text_query'],
        },
      },
    ],
    capabilities: ['tools'],
  },
  metadata: {
    source: 'official',
    publisher: 'Google',
    documentation: 'https://developers.google.com/maps/ai/grounding-lite',
    endpoint: 'https://mapstools.googleapis.com/mcp',
    notes: 'Set HTTP Headers in registry to {"X-Goog-Api-Key":"YOUR_KEY"}',
  },
}

async function registerOfficialServers() {
  console.log('🚀 Registering official MCP servers...\n')

  // Only register servers that are actually available on npm
  // Google servers are rolling out incrementally and may not be published yet
  const servers = [
    playwrightServer, // ✅ Available: @playwright/mcp exists on npm
    langchainAgentServer, // ✅ Your LangChain MCP instance
    googleMapsMcpServer, // Grounding Lite MCP over HTTP (requires X-Goog-Api-Key header)
    // googleBigQueryServer, // ⏳ Not yet published: @google/bigquery-mcp returns 404
  ]
  
  console.log(`📦 Registering ${servers.length} available server(s)...`)
  console.log('⚠️  Note: Google MCP servers (@google/maps-mcp, @google/bigquery-mcp) are not yet published to npm.')
  console.log('   Google is rolling them out incrementally. They will be available soon.\n')

  for (const server of servers) {
    try {
      console.log(`📦 Registering: ${server.name} (${server.serverId})`)
      
      const result = await registryService.publishServer({
        serverId: server.serverId,
        name: server.name,
        description: server.description,
        version: server.version,
        // Explicitly set to undefined to clear STDIO mode for HTTP servers
        command: server.command || undefined,
        args: (server.args && Array.isArray(server.args) && server.args.length > 0) ? (server.args as string[]) : undefined,
        env: server.env,
        tools: server.tools,
        capabilities: server.capabilities,
        metadata: server.metadata,
        publishedBy: 'system',
      })

      console.log(`   ✅ Successfully registered: ${result.serverId}\n`)
    } catch (error: any) {
      if (error.message?.includes('Unique constraint') || error.message?.includes('already exists')) {
        console.log(`   ⚠️  Already exists, skipping...\n`)
      } else {
        console.error(`   ❌ Failed to register ${server.serverId}:`, error.message)
        console.log()
      }
    }
  }

  console.log('✨ Done registering official servers!')
}

// Run if executed directly
if (require.main === module) {
  registerOfficialServers()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { registerOfficialServers }
