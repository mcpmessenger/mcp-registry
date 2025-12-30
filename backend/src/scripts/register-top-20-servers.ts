import { registryService } from '../services/registry.service'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Register the top 20 MCP servers from the manifest file
 * 
 * This script reads servers.json and registers all servers to the registry.
 * Run with: npm run register-top-20
 */

interface ServerManifest {
  id: string
  name: string
  description: string
  command?: string // Optional for HTTP servers
  args?: string[] // Optional for HTTP servers
  endpoint?: string // For HTTP servers
  env: string[]
  requires_args?: boolean
  tools?: Array<{
    name: string
    description: string
    inputSchema: {
      type: string
      properties: Record<string, unknown>
      required?: string[]
    }
  }>
}

async function registerTop20Servers() {
  console.log('🚀 Registering top 20 MCP servers...\n')

  // Read the manifest file
  const manifestPath = path.join(__dirname, '../../data/top-20-servers.json')
  
  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ Manifest file not found: ${manifestPath}`)
    process.exit(1)
  }

  const manifestContent = fs.readFileSync(manifestPath, 'utf-8')
  const servers: ServerManifest[] = JSON.parse(manifestContent)

  console.log(`📦 Found ${servers.length} server(s) in manifest\n`)

  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (const server of servers) {
    try {
      // Convert manifest format to registry format
      // serverId format: "org.name/server-name"
      // For official MCP servers, use "modelcontextprotocol/{id}"
      // For context7, use "context7/{id}"
      const orgName = server.id === 'context7' ? 'context7' : 'modelcontextprotocol'
      const serverId = `${orgName}/${server.id}`

      console.log(`📦 Registering: ${server.name} (${serverId})`)

      // Convert env array to Record<string, string>
      // For tool discovery, we provide placeholder values so servers can start
      // Users will provide actual values when installing/using the server
      const envRecord: Record<string, string> = {}
      server.env.forEach((envVar) => {
        // Provide placeholder values for tool discovery
        // Different placeholders based on common env var patterns
        if (envVar.includes('API_KEY') || envVar.includes('TOKEN')) {
          envRecord[envVar] = 'placeholder-for-discovery'
        } else if (envVar.includes('URL')) {
          envRecord[envVar] = 'https://placeholder.example.com'
        } else if (envVar.includes('PASSWORD') || envVar.includes('SECRET')) {
          envRecord[envVar] = 'placeholder-secret'
        } else {
          envRecord[envVar] = 'placeholder'
        }
      })

      // Build metadata
      const metadata: any = {
        source: 'official',
        publisher: 'Model Context Protocol',
        verified: true,
        requiresEnv: server.env.length > 0,
        envVars: server.env,
      }

      // Add npm package info for STDIO servers
      if (server.args && server.args.length > 0) {
        const npmPackage = server.args[server.args.length - 1]
        metadata.npmPackage = npmPackage
      }

      // For HTTP servers, add endpoint to metadata
      if (server.endpoint && !server.command) {
        metadata.endpoint = server.endpoint
        metadata.notes = 'HTTP server. Configure API keys in HTTP Headers field when editing.'
      }

      const tools = server.tools && server.tools.length > 0 ? server.tools : undefined
      const manifest: Record<string, unknown> | undefined = server.endpoint
        ? {
            name: server.name,
            version: 'v0.1',
            endpoint: server.endpoint,
            tools: tools,
            capabilities: ['tools'],
          }
        : undefined

      const result = await registryService.publishServer({
        serverId: serverId,
        name: server.name,
        description: server.description,
        version: 'v0.1',
        command: server.command || undefined, // undefined for HTTP servers
        args: server.args || undefined, // undefined for HTTP servers
        env: Object.keys(envRecord).length > 0 ? envRecord : undefined,
        tools: tools,
        capabilities: ['tools'],
        metadata: metadata,
        manifest: manifest,
        publishedBy: 'system',
      })

      console.log(`   ✅ Successfully registered: ${result.serverId}`)
      if (server.command && server.args) {
        console.log(`   ℹ️  Note: Tool discovery may have failed if npm package doesn't exist yet. Tools will be discovered when the package is available.\n`)
      } else {
        console.log()
      }
      successCount++
    } catch (error: any) {
      if (error.message?.includes('Unique constraint') || error.message?.includes('already exists')) {
        console.log(`   ⚠️  Already exists, skipping...\n`)
        skipCount++
      } else {
        console.error(`   ❌ Failed to register ${server.id}:`, error.message)
        console.log()
        errorCount++
      }
    }
  }

  console.log('='.repeat(60))
  console.log('✨ Registration Summary:')
  console.log(`   ✅ Successfully registered: ${successCount}`)
  console.log(`   ⚠️  Already existed (skipped): ${skipCount}`)
  console.log(`   ❌ Failed: ${errorCount}`)
  console.log(`   📊 Total processed: ${servers.length}`)
  console.log('='.repeat(60))
}

// Run if executed directly
if (require.main === module) {
  registerTop20Servers()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { registerTop20Servers }

