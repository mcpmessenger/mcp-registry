# Playwright MCP Deployment Guide

This guide explains how to deploy and use Playwright MCP in production.

## The Problem

Playwright MCP can run in two modes:

1. **STDIO mode** (default) - Uses `npx @playwright/mcp@latest` with JSON-RPC over stdin/stdout
2. **HTTP mode** - Uses `npx @playwright/mcp@latest --port 8931` and exposes an HTTP endpoint

### STDIO Mode Limitations

STDIO mode requires:
- A long-running backend process that can spawn and maintain child processes
- **Does NOT work on serverless platforms** (Vercel functions, AWS Lambda, etc.)

### HTTP Mode Benefits

HTTP mode:
- Can run as a separate service
- Works with any backend (including serverless)
- Can be deployed independently

## Deployment Options

### Option 1: Deploy Backend on Platform Supporting Long-Running Processes (STDIO Mode)

If you want to use STDIO mode (simpler, no separate service needed), deploy your backend on:

- **Railway** (recommended)
- **Render**
- **Fly.io**
- **DigitalOcean App Platform**
- **Heroku**
- **Your own VPS/server**

Steps:
1. Deploy backend to one of these platforms
2. Set `NEXT_PUBLIC_API_URL` in Vercel to your backend URL
3. Playwright will work via STDIO automatically

### Option 2: Run Playwright as Separate HTTP Service (HTTP Mode)

For serverless backends (or if you want Playwright as a separate service):

#### 2.1. Deploy Playwright Service

**On Railway:**
```bash
# Create new Railway service
railway init playwright-mcp

# Set start command
railway variables set START_COMMAND="npx @playwright/mcp@latest --port $PORT --headless"

# Deploy
railway up
```

**On Render:**
```yaml
# render.yaml
services:
  - type: web
    name: playwright-mcp
    env: node
    buildCommand: echo "No build needed"
    startCommand: npx @playwright/mcp@latest --port $PORT --headless
    envVars:
      - key: NODE_VERSION
        value: 18
```

**Using Docker:**
```dockerfile
FROM mcr.microsoft.com/playwright/mcp:latest

EXPOSE 8931

CMD ["node", "cli.js", "--headless", "--browser", "chromium", "--no-sandbox", "--port", "8931"]
```

Then run:
```bash
docker run -d -p 8931:8931 --name playwright-mcp your-image
```

#### 2.2. Update Registry with HTTP Endpoint

After deploying, update the Playwright agent in your registry:

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

**Via Registry UI:**
1. Go to Registry page
2. Find "Playwright MCP Server"
3. Click Edit
4. Add endpoint: `https://your-playwright-service.com/mcp`
5. Remove or clear `command` and `args` fields (not needed for HTTP mode)
6. Save

## Quick Start: Local Testing

Test Playwright HTTP mode locally:

```bash
# Terminal 1: Start Playwright HTTP server
npx @playwright/mcp@latest --port 8931

# Terminal 2: Update registry (if backend is running)
curl -X PUT http://localhost:3001/v0.1/servers/com.microsoft.playwright%2Fmcp \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "endpoint": "http://localhost:8931/mcp"
    },
    "command": null,
    "args": null
  }'
```

Then test in your frontend!

## Environment Variables

### Frontend (Vercel)
```env
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

### Backend
```env
# For STDIO mode - no extra config needed
# For HTTP mode - Playwright endpoint handled via registry metadata
```

### Playwright Service (if separate)
```env
PORT=8931  # Required for Railway/Render
# Optional: --headless flag for headless browsers
```

## Troubleshooting

### Error: "Agent is missing an endpoint URL"

This means:
- **STDIO mode**: Backend is not accessible or deployed on serverless platform
- **HTTP mode**: Endpoint not configured in registry

**Fix:**
- Deploy backend to Railway/Render/etc (for STDIO)
- OR configure Playwright HTTP endpoint in registry (for HTTP)

### Error: "Cannot connect to backend"

Frontend can't reach backend API.

**Fix:**
- Set `NEXT_PUBLIC_API_URL` in Vercel environment variables
- Ensure backend is deployed and accessible
- Check CORS settings on backend

### Error: "Request timeout" or "Process spawn failed"

Backend can't spawn Playwright process (serverless limitation).

**Fix:**
- Use HTTP mode instead of STDIO
- OR deploy backend to platform supporting long-running processes

## Recommended Setup

For production:

1. **Frontend**: Vercel
2. **Backend**: Railway or Render (supports STDIO)
3. **Database**: PostgreSQL (Railway/Render managed)
4. **Playwright**: 
   - **Option A**: Via backend STDIO (if backend supports it)
   - **Option B**: Separate Railway/Render service in HTTP mode

Option A is simpler (one less service), but Option B gives more flexibility.
