# Playwright MCP HTTP Server - Developer Brief

**To:** Server Development Team  
**From:** MCP Registry Team  
**Date:** December 2024  
**Priority:** Medium  
**Status:** Ready for Development

---

## Executive Summary

We need a standalone HTTP service that wraps Microsoft's `@playwright/mcp` package to enable browser automation capabilities via HTTP endpoints. This service will allow the MCP Registry to use Playwright in serverless environments where STDIO-based communication doesn't work.

**TL;DR:** Build an HTTP wrapper around `npx @playwright/mcp@latest` that exposes MCP protocol over HTTP instead of stdin/stdout.

---

## The Problem

Currently, Playwright MCP runs via STDIO (standard input/output), which requires:
- A long-running backend process
- Ability to spawn child processes
- Persistent process communication

**This doesn't work on serverless platforms** (Vercel, AWS Lambda, Cloudflare Workers), limiting where we can deploy our backend.

---

## The Solution

Build a standalone HTTP service that:
1. Runs `@playwright/mcp@latest` as a child process (STDIO mode internally)
2. Exposes HTTP endpoints for MCP protocol communication
3. Bridges HTTP requests ↔ STDIO communication with Playwright
4. Can be deployed independently (Railway, Render, Docker, etc.)

---

## Key Requirements

### Must Have (MVP)
- ✅ HTTP endpoint that accepts MCP JSON-RPC messages
- ✅ Support for core Playwright tools (navigate, screenshot, click, type)
- ✅ Health check endpoint (`/health`)
- ✅ Compatible with MCP v0.1 specification
- ✅ Deployable to Railway/Render/Docker

### Should Have
- Session management
- Error handling and recovery
- Logging
- Graceful shutdown

### Nice to Have
- Metrics endpoint
- Multiple concurrent sessions
- Rate limiting

---

## Architecture Overview

```
Client (Frontend)
    │
    ▼ HTTP Request (JSON-RPC)
HTTP Server (Express/Fastify)
    │
    ▼ Spawn Process & STDIO Communication
@playwright/mcp (via npx)
    │
    ▼ Browser Automation
Chromium Browser
```

**Your Implementation:**
1. Create Express/Fastify server
2. Spawn `npx @playwright/mcp@latest` as child process
3. Send JSON-RPC messages via stdin
4. Read responses from stdout
5. Return HTTP responses to clients

---

## API Specification

### POST /mcp
Main MCP protocol endpoint. Accepts JSON-RPC 2.0 messages.

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "browser_navigate",
    "arguments": {
      "url": "https://example.com"
    }
  }
}
```

**Example Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Navigation completed"
      }
    ],
    "isError": false
  }
}
```

### GET /health
Health check endpoint (for deployment platforms).

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600
}
```

---

## Technical Stack

- **Runtime:** Node.js 18+ (LTS)
- **Package:** `@playwright/mcp@latest` (official Microsoft package)
- **HTTP Framework:** Express.js or Fastify
- **Protocol:** MCP (Model Context Protocol) v0.1 over HTTP
- **Browser:** Chromium (headless mode)

**Dependencies:**
```json
{
  "dependencies": {
    "@playwright/mcp": "latest",
    "express": "^4.18.0",
    "cors": "^2.8.5"
  }
}
```

---

## Implementation Approach

### Option 1: Simple STDIO Bridge (Recommended for MVP)

1. Spawn Playwright process:
   ```typescript
   const proc = spawn('npx', ['-y', '@playwright/mcp@latest'])
   ```

2. Send JSON-RPC via stdin:
   ```typescript
   proc.stdin.write(JSON.stringify(request) + '\n')
   ```

3. Read response from stdout:
   ```typescript
   proc.stdout.on('data', (data) => {
     // Parse JSON-RPC response
   })
   ```

4. Return HTTP response to client

### Option 2: Use Official MCP SDK (If Available)

Microsoft may provide an MCP SDK that can help with protocol handling. Check the [Playwright MCP GitHub](https://github.com/microsoft/playwright-mcp) for latest updates.

---

## Critical MCP Protocol Methods

Your server must support:
- `initialize` - Initialize connection
- `tools/list` - List available tools
- `tools/call` - Invoke a tool (this is the main one)
- `initialized` - Confirm initialization

See MCP specification: https://modelcontextprotocol.io

---

## Key Playwright Tools to Support

These are the most important tools users will use:
- `browser_navigate` - Navigate to URLs
- `browser_take_screenshot` - Take screenshots
- `browser_snapshot` - Get accessibility snapshot
- `browser_click` - Click elements
- `browser_type` - Type text
- `browser_fill_form` - Fill forms

See full list in the PRD (14+ tools total).

---

## Deployment Requirements

### Must Support:
- **Railway** - Set `START_COMMAND="npx @playwright/mcp@latest --port $PORT"`
- **Render** - Use `render.yaml` or web service type
- **Docker** - Include Dockerfile based on `mcr.microsoft.com/playwright/mcp`

### Environment Variables:
- `PORT` - HTTP server port (default: 8931)
- `PLAYWRIGHT_HEADLESS` - Headless mode (default: true)

---

## Testing Requirements

### Manual Testing Checklist:
- [ ] Service starts successfully
- [ ] Health endpoint returns 200
- [ ] Can navigate to a URL
- [ ] Can take a screenshot
- [ ] Can click elements
- [ ] Handles errors gracefully
- [ ] Shuts down gracefully

### Integration Testing:
Test with the MCP Registry backend:
1. Deploy your service
2. Update registry: `PUT /v0.1/servers/com.microsoft.playwright/mcp` with your endpoint
3. Frontend should be able to use Playwright tools

---

## Timeline Estimate

- **Week 1:** Core implementation (HTTP server + STDIO bridge)
- **Week 2:** Tool support + error handling + deployment
- **Week 3:** Testing + documentation

**Total:** 2-3 weeks for production-ready service

---

## Success Criteria

✅ Service can be deployed to Railway with zero config  
✅ MCP Registry backend can invoke Playwright tools via HTTP  
✅ All core browser operations work  
✅ Average response time < 2 seconds for screenshots  
✅ Service uptime > 99.5%

---

## Full Documentation

See **`PRD_PLAYWRIGHT_HTTP_SERVER.md`** for:
- Complete API specification
- Detailed architecture diagrams
- Implementation examples
- Testing strategies
- Deployment guides for all platforms

---

## Getting Started

1. **Read the PRD:** `PRD_PLAYWRIGHT_HTTP_SERVER.md` (full specification)
2. **Study Playwright MCP:** https://github.com/microsoft/playwright-mcp
3. **Check MCP Spec:** https://modelcontextprotocol.io
4. **Create new repo** for the service
5. **Start with minimal HTTP server** + STDIO bridge

---

## Questions?

If you need clarification on:
- MCP protocol details
- Playwright integration
- Deployment requirements
- Integration with MCP Registry

Please reach out to the MCP Registry team.

---

## Reference Links

- **Full PRD:** `PRD_PLAYWRIGHT_HTTP_SERVER.md`
- **Playwright MCP:** https://github.com/microsoft/playwright-mcp
- **MCP Specification:** https://modelcontextprotocol.io
- **JSON-RPC 2.0:** https://www.jsonrpc.org/specification
- **Decision Doc:** `PLAYWRIGHT_SERVER_TYPE_DECISION.md`

---

**Ready to build!** 🚀

The backend already supports HTTP-based servers, so once your service is deployed, just update the registry endpoint and it will work automatically.
