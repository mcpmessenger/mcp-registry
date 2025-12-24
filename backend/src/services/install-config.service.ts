import type { MCPServer } from '../types/mcp'
import * as os from 'os'
import * as path from 'path'

export type InstallClient = 'claude-desktop' | 'cursor' | 'windsurf' | 'cli'

export interface InstallConfig {
  client: InstallClient
  config: string
  instructions: string
  filePath?: string
  downloadUrl?: string
}

export interface ServerPermissions {
  capabilities: string[]
  tools: Array<{
    name: string
    description: string
    permissions: string[]
  }>
  warnings: string[]
}

export class InstallConfigService {
  /**
   * Generate install configuration for a specific client
   */
  generateInstallConfig(server: MCPServer, client: InstallClient, userAgent?: string): InstallConfig {
    switch (client) {
      case 'claude-desktop':
        return this.generateClaudeDesktopConfig(server)
      case 'cursor':
      case 'windsurf':
        return this.generateCursorConfig(server, client)
      case 'cli':
        return this.generateCLIConfig(server)
      default:
        throw new Error(`Unsupported client: ${client}`)
    }
  }

  /**
   * Generate Claude Desktop configuration (.mcpb bundle)
   */
  private generateClaudeDesktopConfig(server: MCPServer): InstallConfig {
    // For HTTP servers, we need to use a different approach
    // Claude Desktop supports both STDIO and HTTP servers
    const serverConfig: any = {}
    
    if (server.command && server.args) {
      // STDIO server
      serverConfig.command = server.command
      serverConfig.args = server.args
      if (server.env && Object.keys(server.env).length > 0) {
        serverConfig.env = server.env
      }
    } else if (server.metadata && typeof server.metadata === 'object') {
      // HTTP server - Claude Desktop may support this via URL
      const metadata = server.metadata as Record<string, unknown>
      if (metadata.endpoint) {
        serverConfig.url = metadata.endpoint
      }
    }
    
    const config = {
      mcpServers: {
        [server.serverId]: serverConfig,
      },
    }

    // For Claude Desktop, we'll generate a JSON file that can be downloaded
    // The user can drag and drop this into Claude Desktop
    const configJson = JSON.stringify(config, null, 2)

    return {
      client: 'claude-desktop',
      config: configJson,
      instructions: `1. Download the configuration file below
2. Open Claude Desktop
3. Go to Settings → MCP Servers
4. Drag and drop the downloaded file, or copy its contents to your Claude Desktop config`,
      filePath: this.getClaudeDesktopConfigPath(),
    }
  }

  /**
   * Generate Cursor/Windsurf configuration (JSON snippet for mcp_config.json)
   */
  private generateCursorConfig(server: MCPServer, client: InstallClient): InstallConfig {
    // Cursor/Windsurf support both STDIO and HTTP servers
    const configEntry: any = {}
    
    if (server.command && server.args) {
      // STDIO server
      configEntry[server.serverId] = {
        command: server.command,
        args: server.args,
      }
      if (server.env && Object.keys(server.env).length > 0) {
        configEntry[server.serverId].env = server.env
      }
    } else if (server.metadata && typeof server.metadata === 'object') {
      // HTTP server
      const metadata = server.metadata as Record<string, unknown>
      if (metadata.endpoint) {
        configEntry[server.serverId] = {
          url: metadata.endpoint,
        }
        if (metadata.httpHeaders) {
          configEntry[server.serverId].headers = metadata.httpHeaders
        }
      }
    } else {
      // Fallback - try to construct from available data
      configEntry[server.serverId] = {
        command: server.command || 'npx',
        args: server.args || [],
      }
      if (server.env && Object.keys(server.env).length > 0) {
        configEntry[server.serverId].env = server.env
      }
    }

    const configJson = JSON.stringify(configEntry, null, 2)
    const configPath = this.getCursorConfigPath()

    return {
      client,
      config: configJson,
      instructions: `1. Copy the JSON configuration below
2. Open ${configPath} in your editor
3. Add the configuration to the "mcpServers" object
4. Restart ${client === 'cursor' ? 'Cursor' : 'Windsurf'}`,
      filePath: configPath,
    }
  }

  /**
   * Generate CLI installation command (npx)
   */
  private generateCLIConfig(server: MCPServer): InstallConfig {
    // For CLI, we'll generate an npx command that can be run directly
    const command = server.command || 'npx'
    const args = server.args || []
    const envVars = server.env || {}

    // Build the command
    let cliCommand = `${command} ${args.join(' ')}`

    // Add environment variables if any
    if (Object.keys(envVars).length > 0) {
      const envString = Object.entries(envVars)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ')
      cliCommand = `${envString} ${cliCommand}`
    }

    return {
      client: 'cli',
      config: cliCommand,
      instructions: `Run this command in your terminal to install and use the MCP server:
      
${cliCommand}

Or use it with an MCP client:
npx -y @modelcontextprotocol/cli ${args.join(' ')}`,
    }
  }

  /**
   * Get Claude Desktop config path based on OS
   */
  private getClaudeDesktopConfigPath(): string {
    const platform = os.platform()
    const homeDir = os.homedir()

    switch (platform) {
      case 'darwin': // macOS
        return path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
      case 'win32': // Windows
        return path.join(
          process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'),
          'Claude',
          'claude_desktop_config.json'
        )
      case 'linux':
        return path.join(homeDir, '.config', 'claude', 'claude_desktop_config.json')
      default:
        return path.join(homeDir, '.claude', 'claude_desktop_config.json')
    }
  }

  /**
   * Get Cursor/Windsurf config path based on OS
   */
  private getCursorConfigPath(): string {
    const platform = os.platform()
    const homeDir = os.homedir()

    switch (platform) {
      case 'darwin': // macOS
        return path.join(homeDir, '.cursor', 'mcp_config.json')
      case 'win32': // Windows
        return path.join(
          process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'),
          'Cursor',
          'mcp_config.json'
        )
      case 'linux':
        return path.join(homeDir, '.config', 'cursor', 'mcp_config.json')
      default:
        return path.join(homeDir, '.cursor', 'mcp_config.json')
    }
  }

  /**
   * Analyze server permissions and capabilities
   */
  analyzePermissions(server: MCPServer): ServerPermissions {
    const permissions: ServerPermissions = {
      capabilities: server.capabilities || [],
      tools: [],
      warnings: [],
    }

    // Analyze each tool for potential security concerns
    for (const tool of server.tools || []) {
      const toolPermissions: string[] = []
      const toolName = tool.name.toLowerCase()
      const toolDesc = (tool.description || '').toLowerCase()

      // Check for file system access
      if (
        toolName.includes('file') ||
        toolName.includes('read') ||
        toolName.includes('write') ||
        toolDesc.includes('file system') ||
        toolDesc.includes('read file') ||
        toolDesc.includes('write file')
      ) {
        toolPermissions.push('File System Access')
        permissions.warnings.push(`Tool "${tool.name}" may access your file system`)
      }

      // Check for network access
      if (
        toolName.includes('http') ||
        toolName.includes('fetch') ||
        toolName.includes('request') ||
        toolName.includes('api') ||
        toolDesc.includes('network') ||
        toolDesc.includes('http') ||
        toolDesc.includes('api')
      ) {
        toolPermissions.push('Network Access')
        permissions.warnings.push(`Tool "${tool.name}" may make network requests`)
      }

      // Check for browser/playwright access
      if (
        toolName.includes('browser') ||
        toolName.includes('playwright') ||
        toolName.includes('navigate') ||
        toolName.includes('screenshot') ||
        toolDesc.includes('browser') ||
        toolDesc.includes('playwright') ||
        toolDesc.includes('web page')
      ) {
        toolPermissions.push('Browser Control')
        permissions.warnings.push(`Tool "${tool.name}" can control your browser via Playwright`)
      }

      // Check for command execution
      if (
        toolName.includes('exec') ||
        toolName.includes('command') ||
        toolName.includes('run') ||
        toolName.includes('shell') ||
        toolDesc.includes('execute') ||
        toolDesc.includes('command') ||
        toolDesc.includes('shell')
      ) {
        toolPermissions.push('Command Execution')
        permissions.warnings.push(`Tool "${tool.name}" may execute system commands`)
      }

      // Check for environment variable access
      if (server.env && Object.keys(server.env).length > 0) {
        toolPermissions.push('Environment Variables')
      }

      permissions.tools.push({
        name: tool.name,
        description: tool.description || '',
        permissions: toolPermissions.length > 0 ? toolPermissions : ['No special permissions detected'],
      })
    }

    return permissions
  }
}

export const installConfigService = new InstallConfigService()

