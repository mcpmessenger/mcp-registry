# Quick Fix: Pending Request Issue

## Problem
The `/invoke` request is stuck in "pending" state when trying to use Playwright MCP Server. This was working yesterday before deployment.

## Likely Causes

1. **Playwright server not properly registered** - The server might need to be re-registered
2. **Backend timeout** - Playwright browser launch is taking too long
3. **Deployment issue** - Something changed during deployment

## Quick Fixes

### Fix 1: Re-register Playwright Server

The Playwright server might need to be re-registered on the backend:

```powershell
# Connect to backend and re-register
cd backend
npm run register-official
```

This will ensure the Playwright server is properly configured in the database.

### Fix 2: Check Backend Logs

Check Cloud Run logs to see what's happening:

```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=mcp-registry-backend" --limit 50 --format json
```

Or check in Google Cloud Console:
1. Go to Cloud Run
2. Click on `mcp-registry-backend`
3. Click "Logs" tab
4. Look for errors related to Playwright

### Fix 3: Restart Backend Service

Sometimes a restart helps:

```powershell
gcloud run services update mcp-registry-backend --region us-central1 --no-traffic
gcloud run services update mcp-registry-backend --region us-central1
```

### Fix 4: Verify Playwright Server Registration

Check if the server is registered:

```powershell
$serverId = "com.microsoft.playwright/mcp"
$encoded = [System.Web.HttpUtility]::UrlEncode($serverId)
Invoke-RestMethod -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers/$encoded"
```

Should return server details with `command: "npx"` and `args: ["-y", "@playwright/mcp@latest"]`.

## What Changed?

Since it was working yesterday, check:
- Was the backend redeployed?
- Were any environment variables changed?
- Was the database migrated/reset?

## If Still Not Working

The Playwright MCP server might be hitting the GPU timeout issue we saw earlier. In that case, you may need to:

1. Configure Playwright with GPU-disabled flags (see `docs/PLAYWRIGHT_GPU_FIX.md`)
2. Or use a separate Playwright HTTP service instead of STDIO mode
