import { registryService } from '../services/registry.service'
import { installConfigService } from '../services/install-config.service'

async function run() {
  try {
    const server = await registryService.getServerById('io.github.exa-labs/exa-mcp-server')
    if (!server) {
      console.error('Exa server not found in registry')
      process.exit(1)
    }

    console.log('Server:', server.serverId, server.name)

    const cliConfig = installConfigService.generateInstallConfig(server, 'cli')
    console.log('\nCLI Install Command:')
    console.log(cliConfig.config)

    const claudeConfig = installConfigService.generateInstallConfig(server, 'claude-desktop')
    console.log('\nClaude Desktop Config:')
    console.log(claudeConfig.config)

    const cursorConfig = installConfigService.generateInstallConfig(server, 'cursor')
    console.log('\nCursor Config:')
    console.log(cursorConfig.config)
  } catch (err) {
    console.error('Error:', err)
  }
}

run()
