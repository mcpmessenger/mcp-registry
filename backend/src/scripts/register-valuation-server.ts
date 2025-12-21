import { registryService } from '../services/registry.service'
import type { MCPTool } from '../types/mcp'

/**
 * Register Valuation MCP Server
 * 
 * HTTP-based MCP server for GitHub repository valuation analysis
 * Base URL: https://valuation-mcp-server-lwo3sf5jba-uc.a.run.app
 */

const valuationServer = {
  serverId: 'com.valuation/mcp-server',
  name: 'Valuation Analysis MCP Server',
  description: 'Valuation Analysis MCP Server with Unicorn Hunter 🦄 - Analyze GitHub repositories and calculate unicorn scores',
  version: '1.3.0',
  // HTTP-based server - no command/args needed
  command: undefined,
  args: undefined,
  env: {},
  tools: [
    {
      name: 'agent_executor',
      description: 'Comprehensive analysis tool - Full analysis including codebase analysis in a single request',
      inputSchema: {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Natural language query, e.g., "what\'s the unicorn score for facebook/react with codebase analysis?"',
          },
        },
        required: ['input'],
      },
    } as MCPTool,
    {
      name: 'analyze_github_repository',
      description: 'Get basic repository data and metrics',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'GitHub repository owner (e.g., "facebook")',
          },
          repo: {
            type: 'string',
            description: 'GitHub repository name (e.g., "react")',
          },
        },
        required: ['owner', 'repo'],
      },
    } as MCPTool,
    {
      name: 'unicorn_hunter',
      description: 'Calculate unicorn scores and valuations from existing repo data',
      inputSchema: {
        type: 'object',
        properties: {
          repo_data: {
            type: 'object',
            description: 'Repository data from analyze_github_repository',
          },
        },
        required: ['repo_data'],
      },
    } as MCPTool,
  ] as MCPTool[],
  capabilities: ['tools'],
  metadata: {
    source: 'external',
    endpoint: 'https://valuation-mcp-server-lwo3sf5jba-uc.a.run.app',
    version: '1.3.0',
    documentation: 'https://valuation-mcp-server-lwo3sf5jba-uc.a.run.app',
  },
}

async function registerValuationServer() {
  try {
    console.log('Registering Valuation MCP Server...')
    
    const result = await registryService.publishServer({
      serverId: valuationServer.serverId,
      name: valuationServer.name,
      description: valuationServer.description,
      version: valuationServer.version,
      command: valuationServer.command,
      args: valuationServer.args,
      env: valuationServer.env,
      tools: valuationServer.tools,
      capabilities: valuationServer.capabilities,
      metadata: valuationServer.metadata,
      publishedBy: 'system',
    })
    
    console.log('✅ Successfully registered Valuation MCP Server:', result.serverId)
    console.log('   Name:', result.name)
    console.log('   Endpoint:', valuationServer.metadata.endpoint)
    console.log('   Tools:', valuationServer.tools.map(t => t.name).join(', '))
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log('⚠️  Valuation MCP Server already registered. Updating...')
      
      // Try to update by publishing again (publishServer handles updates)
      try {
        const updated = await registryService.publishServer({
          serverId: valuationServer.serverId,
          name: valuationServer.name,
          description: valuationServer.description,
          version: valuationServer.version,
          command: valuationServer.command,
          args: valuationServer.args,
          env: valuationServer.env,
          tools: valuationServer.tools,
          capabilities: valuationServer.capabilities,
          metadata: valuationServer.metadata,
          publishedBy: 'system',
        })
        console.log('✅ Successfully updated Valuation MCP Server:', updated.serverId)
      } catch (updateError) {
        console.error('❌ Failed to update server:', updateError)
        process.exit(1)
      }
    } else {
      console.error('❌ Failed to register server:', error)
      process.exit(1)
    }
  }
}

// Run if executed directly
if (require.main === module) {
  registerValuationServer()
    .then(() => {
      console.log('Registration complete')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Registration failed:', error)
      process.exit(1)
    })
}

export { registerValuationServer, valuationServer }

