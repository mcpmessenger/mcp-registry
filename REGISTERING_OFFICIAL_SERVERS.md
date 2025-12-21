# Registering Official MCP Servers

This guide explains how to register official MCP servers from Microsoft, Google, and other trusted sources in your registry.

## Overview

Instead of building MCP servers from scratch, you can register existing, production-ready servers from:

- **Microsoft**: [@playwright/mcp](https://github.com/microsoft/playwright-mcp) - Browser automation
- **Google**: Official MCP servers (rolling out) - Maps, BigQuery, GKE, GCE, etc.

## Quick Start

### Register Official Servers

Run the registration script:

```bash
cd backend
npm run register-official
```

This will register:
1. ✅ **Microsoft Playwright MCP** - Available now
2. ⏳ **Google Maps MCP** - Coming soon (Google is rolling out incrementally)
3. ⏳ **Google BigQuery MCP** - Coming soon

## What Gets Registered

### Microsoft Playwright MCP Server

**Server ID**: `com.microsoft.playwright/mcp`

**Features**:
- Browser automation (navigate, click, type, fill forms)
- Accessibility snapshots (better than screenshots for LLMs)
- Screenshot capture
- JavaScript evaluation
- Form filling
- Tab management

**Installation**: Uses `npx @playwright/mcp@latest` (no local installation needed)

**Tools Registered**:
- `browser_navigate` - Navigate to URLs
- `browser_snapshot` - Capture accessibility tree
- `browser_click` - Click elements
- `browser_type` - Type text
- `browser_fill_form` - Fill multiple form fields
- `browser_take_screenshot` - Take screenshots
- `browser_evaluate` - Run JavaScript

### Google Maps MCP Server

**Server ID**: `com.google.maps/mcp`

**Status**: ⏳ Coming soon (Google is rolling out incrementally)

**Features** (when available):
- Place search
- Place details
- Weather forecasts
- Route calculation
- Geocoding

### Google BigQuery MCP Server

**Server ID**: `com.google.bigquery/mcp`

**Status**: ⏳ Coming soon

**Features** (when available):
- Execute SQL queries
- Schema introspection
- Data forecasting
- Enterprise data access

## Manual Registration

You can also register servers manually via the API:

```bash
curl -X POST http://localhost:3001/v0.1/publish \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "com.microsoft.playwright/mcp",
    "name": "Playwright MCP Server",
    "description": "Official Microsoft Playwright MCP server",
    "version": "v0.1",
    "command": "npx",
    "args": ["-y", "@playwright/mcp@latest"],
    "capabilities": ["tools"],
    "tools": [...]
  }'
```

## Verifying Registration

Check if servers are registered:

```bash
# List all servers
curl http://localhost:3001/v0.1/servers

# Get specific server
curl http://localhost:3001/v0.1/servers/com.microsoft.playwright%2Fmcp

# Search for Playwright
curl "http://localhost:3001/v0.1/servers?search=playwright"
```

## Updating Server Information

When official servers update, you can update the registry:

```bash
curl -X PUT http://localhost:3001/v0.1/servers/com.microsoft.playwright%2Fmcp \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v0.2",
    "description": "Updated description"
  }'
```

## Benefits of Using Official Servers

1. **Production Ready**: Built and maintained by Microsoft/Google
2. **Well Tested**: Used by thousands of developers
3. **Regular Updates**: Actively maintained
4. **Documentation**: Comprehensive docs and examples
5. **No Maintenance**: You don't need to build or maintain them
6. **Verified**: Marked as verified/trusted in your registry

## Custom vs Official Servers

### Use Official Servers When:
- ✅ The functionality already exists
- ✅ You want production-grade reliability
- ✅ You don't want to maintain server code
- ✅ You need enterprise support

### Build Custom Servers When:
- ✅ You need specific functionality not available
- ✅ You want to integrate with internal APIs
- ✅ You need custom business logic
- ✅ You want full control over implementation

## Next Steps

1. **Run the registration script** to add official servers
2. **Test the servers** by invoking tools via your registry
3. **Monitor Google's rollout** for new official MCP servers
4. **Build custom servers** only for unique use cases

## Resources

- [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [Google MCP Announcement](https://cloud.google.com/blog/products/ai-machine-learning/announcing-official-mcp-support-for-google-services)
- [MCP Registry Developer Guide](./Official%20Model%20Context%20Protocol%20(MCP)%20Registry_%20Developer%20Guide.md)
