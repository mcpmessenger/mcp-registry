# Deployment Testing Plan

This document provides a quick reference for verifying the latest backend deployment (Playwright fix + symlink) and ensuring the frontend is wired to the new Cloud Run service.

**For comprehensive technical architecture and in-depth analysis, see [TECHNICAL_ARCHITECTURE_DEPLOYMENT.md](./TECHNICAL_ARCHITECTURE_DEPLOYMENT.md).**

**For detailed bug analysis and troubleshooting, see [BUG_BOUNTY_PLAYWRIGHT_CHROMIUM.md](../BUG_BOUNTY_PLAYWRIGHT_CHROMIUM.md).**

## Prerequisites

- `gcloud` configured with the `slashmcp` project and sufficient permissions.
- Local `docker` / `gcloud builds` for building the image (not required for verification alone).
- Access to the Cloud Run dashboard or logs for `mcp-registry-backend`.
- Frontend env var `NEXT_PUBLIC_API_URL` pointing to the Cloud Run URL (`https://mcp-registry-backend-554655392699.us-central1.run.app`).

## 1. Rebuild & redeploy backend (when needed)

1. From `backend/`, rebuild and push the image using the Dockerfile:
   ```powershell
   cd C:\Users\senti\OneDrive\Desktop\mcp-registry\backend
   gcloud builds submit --tag gcr.io/slashmcp/mcp-registry-backend:latest --region us-central1 .
   ```

2. Deploy the pushed image so Cloud Run uses the updated binary:
   ```powershell
   gcloud run deploy mcp-registry-backend `
     --image gcr.io/slashmcp/mcp-registry-backend:latest `
     --region us-central1 --platform managed `
     --set-secrets DATABASE_URL=db-url:latest `
     --add-cloudsql-instances slashmcp:us-central1:mcp-registry-db `
     --set-env-vars RUN_MIGRATIONS_ON_STARTUP=true,REGISTER_OFFICIAL_SERVERS_ON_STARTUP=true,CORS_ORIGIN=https://v0-logo-design-ashen-mu.vercel.app,PLAYWRIGHT_CHROME_EXECUTABLE_PATH=/opt/google/chrome/chrome `
     --memory 2Gi `
     --quiet
   ```
   
   **Important Notes:**
   - `--memory 2Gi` is critical for Chromium to have sufficient resources (headless browsers require significant memory)
   - The `BROWSER=chromium` and `EXECUTABLE_PATH` environment variables are set in the Playwright MCP server registration (in code), so they're automatically passed when the server is spawned
   - If your environment variable values contain commas, use a custom delimiter: `--set-env-vars "^@^VAR1=value1@VAR2=value2"`

## 2. Backend verification

1. Confirm Playwright chrome symlink exists in the deployed image by checking the startup logs:
   ```powershell
   gcloud run services logs read mcp-registry-backend --region us-central1 --limit 50
   ```
   Look for logs showing:
   - `Created symlinks: /usr/bin/chromium-browser -> ...` (confirms symlinks were created)
   - `✅ MCP server com.microsoft.playwright/mcp initialized successfully` (confirms server starts)
   - Any stderr output from the Playwright MCP server process

2. Hit the health endpoint to ensure the service is ready:
   ```powershell
   Invoke-WebRequest -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/health" -UseBasicParsing
   ```
   Expect `{ "status": "ok", ... }`. Retry after a minute if you recently deployed.

3. Test the MCP servers list:
   ```powershell
   Invoke-WebRequest -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers" -UseBasicParsing
   ```
   A successful JSON response confirms the API is live.

4. Test Playwright tool invocation (if working):
   - Try a browser navigation or screenshot request
   - Check logs for browser launch errors
   - Verify no timeout errors occur

## 3. Frontend verification

1. Ensure Vercel (or GitHub) env var `NEXT_PUBLIC_API_URL` equals `https://mcp-registry-backend-554655392699.us-central1.run.app`.

2. Trigger a Vercel redeploy:
   - Push the branch to GitHub or use Vercel's "Redeploy" button.

3. After deployment completes, confirm:
   - Frontend loads without the "Cannot connect to backend" error.
   - Developer Console shows fetch requests to the Cloud Run URL, not `http://localhost:3001`.
   - Check browser console for: `[API Client] Using backend URL: https://mcp-registry-backend-554655392699.us-central1.run.app`

4. Optionally, call the Playwright screenshot endpoint from the UI or API client and verify success.

## 4. Troubleshooting notes

### Buildpack Detection Errors
- **Cause**: Build initiated from repository root instead of `backend/` directory
- **Solution**: Always run `gcloud builds submit` from the `backend/` folder so the Dockerfile is picked up. Avoid `gcloud run deploy --source .` from the repo root.
- **Verification**: Build logs should show Dockerfile steps, not buildpack detection

### Playwright "Chrome Not Found" Errors

This is the most common issue. The fix involves explicitly telling Playwright to use the 'chromium' channel instead of 'chrome':

- **Root Cause**: Playwright MCP server defaults to looking for Google Chrome (branded browser), but Alpine Linux only has Chromium
- **Fix Applied**: Set `BROWSER=chromium` environment variable in the Playwright MCP server registration (see `backend/src/scripts/register-official-servers.ts`)
- **Symlink Verification**: 
  - Check build logs for: `Created symlinks: /usr/bin/chromium-browser -> ...`
  - Verify symlinks exist at:
    - `/opt/google/chrome/chrome` → `/usr/bin/chromium-browser`
    - `/home/node/.cache/ms-playwright/chromium-system/chrome-linux/chrome` → `/usr/bin/chromium-browser`
- **Memory Requirements**: Ensure Cloud Run service has at least **1GB memory** (2GB recommended) for Chromium to run properly
- **Detailed Analysis**: See [BUG_BOUNTY_PLAYWRIGHT_CHROMIUM.md](../BUG_BOUNTY_PLAYWRIGHT_CHROMIUM.md) for comprehensive troubleshooting

### CORS or "Not Running" Errors
- **Cause**: Frontend still pointing to `localhost:3001` or backend CORS not configured correctly
- **Solution**: 
  - Verify `NEXT_PUBLIC_API_URL` is set to `https://mcp-registry-backend-554655392699.us-central1.run.app` in Vercel
  - Check browser Network tab to see actual request URL
  - Verify backend `CORS_ORIGIN` environment variable includes your Vercel domain
- **Note**: Backend CORS middleware allows all `*.vercel.app` domains by default

### Memory Issues
- **Symptom**: Browser operations fail silently or timeout
- **Cause**: Headless Chromium requires significant memory (typically 512MB-1GB per instance)
- **Solution**: Allocate at least 1GB (2GB recommended) to Cloud Run service using `--memory 2Gi` flag
- **Verification**: Check Cloud Run service configuration in GCP console

### Timeout Issues
- **Current Timeout**: 120 seconds for browser operations (increased from 30s)
- **If Still Timing Out**: May indicate browser isn't launching at all, not just being slow
- **Check Logs**: Look for stderr output from Playwright MCP server process indicating browser launch failures

---

## Quick Reference: Key Fixes Applied

1. **Browser Channel Fix**: `BROWSER=chromium` environment variable set in Playwright MCP server registration
2. **Symlink Strategy**: Dual symlinks created at both `/opt/google/chrome/chrome` and Playwright cache directory
3. **Memory Allocation**: Cloud Run service configured with 2GB memory
4. **Timeout Increase**: Browser operation timeout increased to 120 seconds
5. **CORS Configuration**: Backend allows all `*.vercel.app` domains

---

*Last Updated: December 21, 2025*  
*Current Revision: mcp-registry-backend-00064-r47*
