# Valuation MCP Server Setup

## Server Registered ✅

The Valuation Analysis MCP Server has been successfully registered in the MCP Registry.

**Server ID:** `com.valuation/mcp-server`  
**Name:** Valuation Analysis MCP Server  
**Version:** 1.3.0  
**Endpoint:** `https://valuation-mcp-server-lwo3sf5jba-uc.a.run.app`

## Available Tools

1. **`agent_executor`** - Comprehensive analysis tool (recommended)
   - Full analysis including codebase analysis in a single request
   - Input: Natural language query (e.g., "what's the unicorn score for facebook/react with codebase analysis?")

2. **`analyze_github_repository`** - Repository analysis tool
   - Get basic repository data and metrics
   - Input: `{ owner: "facebook", repo: "react" }`

3. **`unicorn_hunter`** - Valuation calculation tool
   - Calculate unicorn scores from existing repo data
   - Input: `{ repo_data: {...} }` (from analyze_github_repository)

## Usage

### In Chat Interface

1. Select "Valuation Analysis MCP Server" from the agent dropdown
2. Ask questions like:
   - "What's the unicorn score for facebook/react with codebase analysis?"
   - "Analyze the repository facebook/react"
   - "Calculate the valuation for microsoft/playwright"

### API Usage

The server is accessible via the MCP Registry API:

```bash
# Get server details
GET http://localhost:3001/v0.1/servers/com.valuation%2Fmcp-server

# Invoke a tool
POST http://localhost:3001/v0.1/invoke
{
  "serverId": "com.valuation/mcp-server",
  "tool": "agent_executor",
  "arguments": {
    "input": "what's the unicorn score for facebook/react with codebase analysis?"
  }
}
```

## How It Works

1. **Frontend** → Selects the Valuation server from the agent list
2. **Frontend** → Calls `/v0.1/invoke` with `serverId: "com.valuation/mcp-server"`
3. **Backend** → Detects it's an HTTP server (no command/args)
4. **Backend** → Extracts endpoint from metadata: `https://valuation-mcp-server-lwo3sf5jba-uc.a.run.app`
5. **Backend** → Forwards request to `${endpoint}/mcp/invoke`
6. **Valuation Server** → Processes the request and returns results
7. **Backend** → Returns results to frontend

## Testing

To test the server:

```bash
# From backend directory
npm run register-valuation

# Then in the frontend, refresh the registry page
# The Valuation Analysis MCP Server should appear in the list
```

## Notes

- The server uses HTTP-based MCP protocol (not STDIO)
- Endpoint is stored in `metadata.endpoint`
- The backend automatically routes to `/mcp/invoke` on the server
- Response format follows MCP spec: `{ content: [{ type: "text", text: "..." }] }`

