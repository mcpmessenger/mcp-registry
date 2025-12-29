/**
 * Test MCP Servers Integration
 * 
 * Tests all registered MCP servers to verify they can be invoked successfully.
 * Run with: npm run test-mcp-servers
 */

import { registryService } from '../services/registry.service'
import { MCPInvokeService } from '../services/mcp-invoke.service'
import { getIntegrationStatus } from '../services/integration-status.service'

async function testMCPServers() {
  console.log('🧪 Testing MCP server integrations...\n')

  try {
    // Get all servers
    const servers = await registryService.getServers()
    console.log(`📦 Found ${servers.length} server(s) to test\n`)

    if (servers.length === 0) {
      console.log('No servers found in registry.')
      return
    }

    const invoker = new MCPInvokeService()
    const results: Array<{
      server: string
      status: string
      success: boolean
      error?: string
      toolTested?: string
    }> = []

    console.log('='.repeat(80))
    console.log('Testing Server Integrations')
    console.log('='.repeat(80) + '\n')

    for (const server of servers) {
      console.log(`Testing: ${server.name} (${server.serverId})`)
      
      // Get integration status first
      const integrationStatus = await getIntegrationStatus(server)
      
      if (integrationStatus.status === 'pre-integration') {
        console.log(`   ⚠️  Pre-Integration: ${integrationStatus.reason}`)
        results.push({
          server: server.name,
          status: 'pre-integration',
          success: false,
          error: integrationStatus.reason,
        })
        console.log()
        continue
      }

      if (integrationStatus.status === 'offline') {
        console.log(`   ❌ Offline: ${integrationStatus.reason}`)
        results.push({
          server: server.name,
          status: 'offline',
          success: false,
          error: integrationStatus.reason,
        })
        console.log()
        continue
      }

      // Server is active - test tool invocation
      if (!server.tools || server.tools.length === 0) {
        console.log(`   ⚠️  No tools available to test`)
        results.push({
          server: server.name,
          status: 'active',
          success: false,
          error: 'No tools available',
        })
        console.log()
        continue
      }

      // Try to invoke the first available tool
      const firstTool = server.tools[0]
      console.log(`   Testing tool: ${firstTool.name}`)

      try {
        // Build minimal test arguments based on tool schema
        const testArgs = buildTestArguments(firstTool)
        
        const result = await invoker.invokeTool({
          serverId: server.serverId,
          tool: firstTool.name,
          arguments: testArgs,
        })

        if (result.result.isError) {
          const errorText = result.result.content[0]?.text || 'Unknown error'
          console.log(`   ❌ Tool invocation failed: ${errorText}`)
          results.push({
            server: server.name,
            status: 'active',
            success: false,
            error: errorText,
            toolTested: firstTool.name,
          })
        } else {
          console.log(`   ✅ Tool invocation successful`)
          results.push({
            server: server.name,
            status: 'active',
            success: true,
            toolTested: firstTool.name,
          })
        }
      } catch (error: any) {
        console.log(`   ❌ Error testing tool: ${error.message}`)
        results.push({
          server: server.name,
          status: 'active',
          success: false,
          error: error.message,
          toolTested: firstTool.name,
        })
      }

      console.log()
    }

    // Summary
    console.log('='.repeat(80))
    console.log('Test Summary')
    console.log('='.repeat(80))
    
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    const preIntegration = results.filter(r => r.status === 'pre-integration').length
    const offline = results.filter(r => r.status === 'offline').length

    console.log(`   ✅ Successful: ${successful}`)
    console.log(`   ❌ Failed: ${failed}`)
    console.log(`   ⚠️  Pre-Integration: ${preIntegration}`)
    console.log(`   🔴 Offline: ${offline}`)
    console.log(`   📊 Total: ${results.length}`)
    console.log('='.repeat(80))

    // Detailed results
    if (failed > 0 || preIntegration > 0) {
      console.log('\nDetailed Results:\n')
      results.forEach(result => {
        if (!result.success || result.status !== 'active') {
          const icon = result.success ? '✅' : result.status === 'pre-integration' ? '⚠️' : '❌'
          console.log(`${icon} ${result.server}`)
          if (result.toolTested) {
            console.log(`   Tool: ${result.toolTested}`)
          }
          if (result.error) {
            console.log(`   Error: ${result.error}`)
          }
          console.log()
        }
      })
    }

    console.log('\n✨ Testing complete!')

  } catch (error) {
    console.error('❌ Error testing servers:', error)
    throw error
  }
}

/**
 * Build test arguments for a tool based on its schema
 */
function buildTestArguments(tool: { name: string; inputSchema?: any }): Record<string, unknown> {
  const args: Record<string, unknown> = {}

  if (!tool.inputSchema || !tool.inputSchema.properties) {
    return args
  }

  const schema = tool.inputSchema
  const properties = schema.properties || {}

  // Build minimal test arguments
  for (const [key, prop] of Object.entries(properties)) {
    const propSchema = prop as any
    
    // Skip if not required and no default
    if (schema.required && !schema.required.includes(key)) {
      continue
    }

    // Set default test values based on type
    if (propSchema.type === 'string') {
      if (key.toLowerCase().includes('query') || key.toLowerCase().includes('search')) {
        args[key] = 'test'
      } else if (key.toLowerCase().includes('url')) {
        args[key] = 'https://example.com'
      } else {
        args[key] = 'test'
      }
    } else if (propSchema.type === 'number') {
      args[key] = 1
    } else if (propSchema.type === 'boolean') {
      args[key] = false
    } else if (propSchema.type === 'array') {
      args[key] = []
    } else if (propSchema.type === 'object') {
      args[key] = {}
    }
  }

  return args
}

// Run if executed directly
if (require.main === module) {
  testMCPServers()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { testMCPServers }

