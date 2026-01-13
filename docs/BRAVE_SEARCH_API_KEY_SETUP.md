# Brave Search MCP API Key Setup Guide

## Summary

The Brave Search MCP server requires a `BRAVE_API_KEY` environment variable. The API key is **passed as an environment variable** (not HTTP headers) because Brave Search MCP uses STDIO transport (command-based), not HTTP transport.

## Key Points

1. **API Key is REQUIRED**: Brave Search MCP will not work without a valid `BRAVE_API_KEY`
2. **Environment Variable (not Headers)**: For STDIO servers like Brave Search, the API key must be in the `env` field, not in HTTP headers
3. **Package Name Fixed**: The package name has been corrected from `@modelcontextprotocol/server-brave-search` to `@brave/brave-search-mcp-server`

## How It Works

The registry stores environment variables in the server's `env` field. When the backend invokes tools on STDIO-based MCP servers:

1. Environment variables from `server.env` are merged with process environment
2. The merged environment is passed to the spawned process (`spawn` command)
3. The Brave Search MCP server reads `BRAVE_API_KEY` from its environment

**Note**: HTTP headers are only used for HTTP-based MCP servers (like Google Maps). STDIO servers use environment variables.

## Getting an API Key

1. Sign up for a Brave Search API account at [Brave Search API](https://api.search.brave.com/)
2. Choose a plan:
   - **Free**: 2,000 queries/month, basic web search
   - **Pro**: Enhanced features including local search, AI summaries, extra snippets
3. Generate your API key from the developer dashboard

## Configuration in SlashMCP.com Registry

1. Navigate to `/registry` page
2. Find **"Brave Search"**
3. Click **Edit**
4. In the **Credentials / Environment Variables** field, ensure you have:
   ```json
   {
     "BRAVE_API_KEY": "YOUR_API_KEY_HERE"
   }
   ```
5. Click **Save**

## Troubleshooting

### Error: `422 SUBSCRIPTION_TOKEN_INVALID` or similar
- **Cause**: API key missing, invalid, or incorrect format
- **Fix**: 
  1. Verify API key is set in registry `env` field (not HTTP headers)
  2. Check API key is valid in Brave Search API dashboard
  3. Ensure your API key has not expired

### Error: Package not found or server fails to start
- **Cause**: Wrong package name was used (old manifest had incorrect package)
- **Fix**: The package name has been corrected to `@brave/brave-search-mcp-server`. If you have an existing registration, you may need to update it or re-register.

### Server status shows "preprocessed" but throws errors
- **Cause**: Usually indicates the server configuration has issues (wrong package name, missing API key, etc.)
- **Fix**: 
  1. Verify the package name in the server configuration is `@brave/brave-search-mcp-server`
  2. Verify `BRAVE_API_KEY` is set in the `env` field
  3. Try re-registering the server with the correct configuration

## Updating Existing Registration

If you have an existing Brave Search server registered with the wrong package name:

### Option 1: Via UI (Easiest)
1. Go to Registry page
2. Find "Brave Search"
3. Click Edit
4. Update the **Args** field to: `["-y", "@brave/brave-search-mcp-server"]`
5. Ensure **Env** has `BRAVE_API_KEY` set
6. Save

### Option 2: Via API
Use PUT `/v0.1/servers/modelcontextprotocol/brave-search` with:
```json
{
  "args": ["-y", "@brave/brave-search-mcp-server"],
  "env": {
    "BRAVE_API_KEY": "YOUR_API_KEY_HERE"
  }
}
```

### Option 3: Re-register
1. Delete the existing "Brave Search" server
2. Run the registration script: `npm run register-top-20`
3. Update the API key via UI

## Difference: STDIO vs HTTP Servers

| Aspect | STDIO Servers (Brave Search) | HTTP Servers (Google Maps) |
|--------|-------------------------------|----------------------------|
| API Key Location | `env` field (environment variables) | `metadata.httpHeaders` (HTTP headers) |
| Transport | Command-based (spawn process) | HTTP requests |
| Example | `{"env": {"BRAVE_API_KEY": "key"}}` | `{"metadata": {"httpHeaders": {"X-Goog-Api-Key": "key"}}}` |

## References

- [Brave Search MCP Server GitHub](https://github.com/brave/brave-search-mcp-server)
- [Brave Search API Documentation](https://api.search.brave.com/)
- [MCP Specification](https://modelcontextprotocol.io/)
