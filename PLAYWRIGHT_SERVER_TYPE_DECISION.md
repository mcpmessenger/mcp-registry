# Playwright MCP Server: STDIO vs HTTP Mode Decision

## TL;DR - Quick Answer

**For a separate Playwright service deployment: Use HTTP mode.**

**Why?** HTTP mode gives you maximum flexibility - it works with any backend (serverless or long-running), can be deployed independently, and scales separately.

## The Two Modes Explained

### STDIO Mode (Default)
- **How it works:** Backend spawns `npx @playwright/mcp@latest` as a child process
- **Communication:** JSON-RPC over stdin/stdout pipes
- **Requirements:** Backend must be a long-running process (not serverless)
- **Pros:**
  - ✅ Simpler - no separate service to manage
  - ✅ Lower latency (direct process communication)
  - ✅ Already implemented in our backend (`mcp-stdio.service.ts`)
- **Cons:**
  - ❌ Requires long-running backend process
  - ❌ Doesn't work on serverless (Vercel functions, Lambda, etc.)
  - ❌ Tied to backend lifecycle (if backend restarts, Playwright restarts)

### HTTP Mode (Recommended for Separate Service)
- **How it works:** Playwright runs as standalone HTTP server with `--port` flag
- **Communication:** HTTP requests to `/mcp` endpoint
- **Requirements:** Just Node.js and the ability to run a service
- **Pros:**
  - ✅ Works with ANY backend (serverless or long-running)
  - ✅ Can be deployed independently
  - ✅ Can scale separately from backend
  - ✅ More resilient (backend can restart without affecting Playwright)
  - ✅ Easier to debug (standard HTTP requests)
- **Cons:**
  - ❌ Slightly higher latency (HTTP overhead)
  - ❌ One more service to manage/deploy

## Our Current Setup

### What We Have Now (STDIO Mode)
Our backend already supports STDIO mode via `backend/src/services/mcp-stdio.service.ts`:
- Automatically detects servers with `command` and `args`
- Spawns processes on-demand
- Manages connections and cleanup
- Works great for servers deployed with the backend

**Current Playwright registration** (`backend/src/scripts/register-official-servers.ts`):
```typescript
const playwrightServer = {
  serverId: 'com.microsoft.playwright/mcp',
  command: 'npx',
  args: ['-y', '@playwright/mcp@latest'],
  // No endpoint needed - STDIO mode
}
```

### What We're Building (HTTP Mode - Separate Service)
A standalone Playwright HTTP service that:
- Runs independently from the backend
- Exposes HTTP endpoint (e.g., `http://playwright-service.com/mcp`)
- Can be deployed on Railway, Render, Fly.io, etc.
- Backend proxies requests to it

**New Playwright registration** (after HTTP service is deployed):
```typescript
const playwrightServer = {
  serverId: 'com.microsoft.playwright/mcp',
  metadata: {
    endpoint: 'https://your-playwright-service.com/mcp'
  },
  // No command/args needed - HTTP mode
}
```

## Decision Matrix

| Scenario | Recommended Mode | Reason |
|----------|------------------|--------|
| Backend on Railway/Render/Fly.io | **STDIO** (via backend) | Simpler, already works, no extra service |
| Backend on Vercel/AWS Lambda | **HTTP** (separate service) | STDIO won't work on serverless |
| Want to scale Playwright separately | **HTTP** (separate service) | Independent scaling |
| Want maximum flexibility | **HTTP** (separate service) | Works with any backend setup |
| Simple deployment, backend handles it | **STDIO** (via backend) | Fewer moving parts |

## Recommendation for Our Project

**Build HTTP mode as a separate service** because:

1. **Flexibility:** Works regardless of where backend is deployed
2. **Future-proof:** If we move backend to serverless later, Playwright still works
3. **Independent scaling:** Can scale Playwright separately if it becomes a bottleneck
4. **Better for production:** Service isolation is a best practice

### Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Vercel         │         │  Backend API     │         │  Playwright     │
│  (Frontend)     │────────▶│  (Railway/etc)   │────────▶│  HTTP Service   │
│                 │         │                  │         │  (Railway/etc)  │
└─────────────────┘         └──────────────────┘         └─────────────────┘
     Port 3000                  Port 3001                    Port 8931
   (serverless)              (long-running)              (long-running)
```

## Implementation Steps

### Step 1: Deploy Playwright HTTP Service

**Option A: Railway (Easiest)**
```bash
# Create new Railway service
railway init playwright-mcp

# Set start command
railway variables set START_COMMAND="npx @playwright/mcp@latest --headless --browser chromium --no-sandbox --port $PORT"

# Deploy
railway up
```

**Option B: Render**
Create `render.yaml`:
```yaml
services:
  - type: web
    name: playwright-mcp
    env: node
    buildCommand: echo "No build needed"
    startCommand: npx @playwright/mcp@latest --headless --browser chromium --no-sandbox --port $PORT
    envVars:
      - key: NODE_VERSION
        value: 18
```

**Option C: Docker**
```dockerfile
FROM mcr.microsoft.com/playwright/mcp:latest

EXPOSE 8931

CMD ["node", "cli.js", "--headless", "--browser", "chromium", "--no-sandbox", "--port", "8931"]
```

### Step 2: Update Registry

After deploying, get your service URL (e.g., `https://playwright-mcp-production.up.railway.app`) and update the registry:

**Via API:**
```bash
curl -X PUT https://your-backend.com/v0.1/servers/com.microsoft.playwright%2Fmcp \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "endpoint": "https://your-playwright-service.com/mcp"
    }
  }'
```

**Via UI:**
1. Go to Registry page
2. Edit "Playwright MCP Server"
3. Add endpoint: `https://your-playwright-service.com/mcp`
4. Clear `command` and `args` fields
5. Save

### Step 3: Test

The backend's `invoke.ts` route will automatically detect it's an HTTP server (no `command`/`args`) and proxy requests to the endpoint.

## Code Changes Needed

### Backend: No Changes Required! ✅

Our backend already handles both modes:
- **STDIO servers:** Has `command` and `args` → uses `mcpStdioService`
- **HTTP servers:** Has `metadata.endpoint` → uses HTTP fetch

The check in `backend/src/routes/v0/invoke.ts`:
```typescript
const isStdioServer = server.command && server.args && server.args.length > 0

if (isStdioServer) {
  // Use STDIO service
} else {
  // Use HTTP endpoint
}
```

### Frontend: No Changes Required! ✅

Frontend just calls `/v0.1/invoke` with `serverId` - backend handles the rest.

## Summary

**Build the Playwright server as HTTP mode** because:
- ✅ Maximum deployment flexibility
- ✅ Works with any backend architecture
- ✅ Can scale independently
- ✅ Future-proof
- ✅ Standard HTTP (easier to debug)

The backend will automatically use HTTP mode when the registry agent has an `endpoint` instead of `command`/`args`.
