# Should You Create a Separate Playwright Server?

## Quick Decision Guide

**Answer: It depends on where your backend is deployed.**

### ✅ You DON'T need a separate server if:

Your backend is deployed on a platform that supports **long-running processes**:
- ✅ Railway
- ✅ Render
- ✅ Fly.io
- ✅ DigitalOcean App Platform
- ✅ Heroku
- ✅ Your own VPS/server
- ✅ Docker container (with proper orchestration)

**Why?** Your backend can spawn `npx @playwright/mcp@latest` as a child process and communicate via STDIO. This is simpler - no extra service to manage!

**What to do:**
1. Deploy backend to one of these platforms
2. Set `NEXT_PUBLIC_API_URL` in Vercel to your backend URL
3. Done! Playwright works automatically via STDIO

### ❌ You DO need a separate server if:

- Your backend is on a **serverless platform** (Vercel, AWS Lambda, Cloudflare Workers)
- You want Playwright as a **separate, scalable service**
- You want **better isolation** between services

**Why?** Serverless functions can't maintain long-running processes, so STDIO mode won't work.

**What to do:**
1. Deploy Playwright as HTTP service (see scripts below)
2. Update registry agent with HTTP endpoint
3. Frontend calls backend → backend proxies to Playwright HTTP service

## Setup Scripts

### Option A: Local Testing

**Windows (PowerShell):**
```powershell
.\scripts\setup-playwright-http-service.ps1
```

**Mac/Linux:**
```bash
chmod +x scripts/setup-playwright-http-service.sh
./scripts/setup-playwright-http-service.sh
```

### Option B: Deploy to Railway

1. Create new Railway project
2. Connect GitHub repo (or use Railway CLI)
3. Set start command:
   ```
   npx @playwright/mcp@latest --headless --browser chromium --no-sandbox --port $PORT
   ```
4. Railway auto-assigns PORT and exposes service
5. Get your service URL (e.g., `https://playwright-mcp-production.up.railway.app`)
6. Update registry with endpoint: `https://your-url.railway.app/mcp`

### Option C: Deploy to Render

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

Then deploy via Render dashboard.

### Option D: Docker

Create `Dockerfile.playwright`:
```dockerfile
FROM mcr.microsoft.com/playwright/mcp:latest

EXPOSE 8931

CMD ["node", "cli.js", "--headless", "--browser", "chromium", "--no-sandbox", "--port", "8931"]
```

Build and run:
```bash
docker build -f Dockerfile.playwright -t playwright-mcp .
docker run -d -p 8931:8931 --name playwright-mcp playwright-mcp
```

## Update Registry After Setup

Once you have your Playwright HTTP service URL, update the registry:

**Via API:**
```bash
curl -X PUT https://your-backend.com/v0.1/servers/com.microsoft.playwright%2Fmcp \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "endpoint": "https://your-playwright-service.com/mcp"
    },
    "command": null,
    "args": null
  }'
```

**Via UI:**
1. Go to Registry page
2. Find "Playwright MCP Server"
3. Click Edit
4. Add endpoint: `https://your-playwright-service.com/mcp`
5. Clear `command` and `args` fields
6. Save

## Recommended Approach

**For most users:** Deploy backend to Railway/Render and use STDIO mode (no separate server needed)

**If backend is serverless:** Create separate Playwright HTTP service on Railway/Render

**Why?**
- STDIO mode is simpler (one less service)
- HTTP mode gives you flexibility to scale Playwright independently
- Both work great, pick based on your architecture
