# STDIO-Based MCP Server Support

## Problem

Official MCP servers like Microsoft Playwright (`@playwright/mcp`) and Google Maps run via `npx` commands (STDIO-based), not HTTP endpoints. The original invoke endpoint only supported HTTP-based servers, causing errors like:

> "Agent 'Google Maps MCP Server' is missing an endpoint URL"

## Solution

The invoke endpoint now supports **both** types of MCP servers:

1. **STDIO-based servers** (npx commands) - Like `@playwright/mcp`
2. **HTTP-based servers** - Traditional REST API endpoints

## How It Works

### Detection

The system automatically detects server type:

- **STDIO**: Has `command` and `args` fields (e.g., `command: "npx"`, `args: ["-y", "@playwright/mcp@latest"]`)
- **HTTP**: Has `endpoint` in metadata/manifest

### STDIO Communication

For STDIO-based servers:

1. **Spawn Process**: The system spawns the `npx` command as a child process
2. **JSON-RPC Protocol**: Communicates via JSON-RPC over stdin/stdout
3. **Connection Management**: Maintains persistent connections per server
4. **Tool Invocation**: Sends `tools/call` requests and receives responses

### HTTP Communication

For HTTP-based servers (unchanged):

1. **HTTP Requests**: Makes POST requests to server endpoints
2. **Multiple Patterns**: Tries `/mcp/invoke`, `/tools/call`, `/api/tools/call`, `/invoke`
3. **CORS Handling**: Acts as proxy to handle CORS

## Usage

### Registering STDIO-Based Servers

When registering official servers, they automatically work:

```typescript
{
  serverId: 'com.microsoft.playwright/mcp',
  command: 'npx',
  args: ['-y', '@playwright/mcp@latest'],
  // No endpoint needed!
}
```

### Invoking Tools

The API automatically handles both types:

```bash
POST /v0.1/invoke
{
  "serverId": "com.microsoft.playwright/mcp",
  "tool": "browser_navigate",
  "arguments": { "url": "https://example.com" }
}
```

Response includes transport type:

```json
{
  "success": true,
  "result": { ... },
  "transport": "stdio"  // or "http"
}
```

## Benefits

1. ✅ **Official servers work out of the box** - No endpoint configuration needed
2. ✅ **Automatic detection** - System detects server type automatically
3. ✅ **Unified API** - Same endpoint works for both types
4. ✅ **Connection pooling** - Reuses STDIO connections for efficiency

## Technical Details

### STDIO Service (`mcp-stdio.service.ts`)

- Manages child processes for STDIO servers
- Handles JSON-RPC protocol
- Maintains connection pool
- Automatic cleanup on server shutdown

### Connection Lifecycle

1. **First Request**: Spawns process, sends `initialize` request
2. **Subsequent Requests**: Reuses existing connection
3. **Cleanup**: Kills process on server shutdown or after inactivity

### Error Handling

- **Connection Errors**: Returns clear error messages
- **Timeout**: 30-second timeout for requests
- **Process Management**: Automatic cleanup of dead processes

## Limitations

1. **Process Management**: STDIO servers run as child processes (resource usage)
2. **Platform Support**: Requires `npx` and Node.js on the server
3. **Concurrency**: Each server gets one process (can be improved with connection pooling)

## Future Improvements

1. **Connection Pooling**: Multiple connections per server for parallel requests
2. **Process Reuse**: Keep processes alive longer for better performance
3. **Health Checks**: Monitor process health and restart if needed
4. **Resource Limits**: Set CPU/memory limits for STDIO processes

## Troubleshooting

### "Server is not connected"

- Ensure `npx` is available in PATH
- Check that the npm package exists and is installable
- Verify command/args are correct

### "Request timeout"

- STDIO servers may be slow to respond
- Check server logs for errors
- Consider increasing timeout

### "Failed to spawn process"

- Verify Node.js is installed
- Check file permissions
- Ensure command is executable

## Example: Playwright MCP

```typescript
// Server registration (automatic via register-official-servers.ts)
{
  serverId: 'com.microsoft.playwright/mcp',
  name: 'Playwright MCP Server',
  command: 'npx',
  args: ['-y', '@playwright/mcp@latest'],
  tools: [
    {
      name: 'browser_navigate',
      description: 'Navigate to a URL',
      // ...
    }
  ]
}

// Tool invocation (automatic detection)
POST /v0.1/invoke
{
  "serverId": "com.microsoft.playwright/mcp",
  "tool": "browser_navigate",
  "arguments": { "url": "https://example.com" }
}

// System automatically:
// 1. Detects STDIO server (has command/args)
// 2. Spawns: npx -y @playwright/mcp@latest
// 3. Sends JSON-RPC: tools/call
// 4. Returns result
```

## Related Files

- `backend/src/services/mcp-stdio.service.ts` - STDIO communication service
- `backend/src/routes/v0/invoke.ts` - Updated invoke endpoint
- `backend/src/scripts/register-official-servers.ts` - Server registration
