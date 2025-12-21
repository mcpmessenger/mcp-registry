# Fix Playwright Browser Installation in Cloud Run

## Problem

When trying to use Playwright MCP server (e.g., "take a screenshot of google.com"), you get this error:

```
Error: browserType.launchPersistentContext: Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome
Run "npx playwright install chrome"
```

## Root Cause

The Docker container doesn't have Playwright browsers installed. The `@playwright/mcp` package needs Chromium (or other browsers) to be installed in the container.

## Solution

The Dockerfile has been updated to install Playwright browsers during the build. You need to **rebuild and redeploy** the backend.

## Steps to Fix

### 1. Rebuild and Redeploy Backend

```powershell
cd backend

# Deploy to Cloud Run (will rebuild with Playwright browsers)
gcloud run deploy mcp-registry-backend `
  --source . `
  --region us-central1 `
  --platform managed `
  --set-secrets DATABASE_URL=db-url:latest `
  --add-cloudsql-instances slashmcp:us-central1:mcp-registry-db `
  --set-env-vars RUN_MIGRATIONS_ON_STARTUP=true,REGISTER_OFFICIAL_SERVERS_ON_STARTUP=true,CORS_ORIGIN=https://v0-logo-design-ashen-mu.vercel.app
```

### 2. Point Playwright at the installed Chromium

Cloud Run already installs Chromium via `apk add chromium`, but Playwright needs to know where that binary lives. Set the environment variable so the `chrome` channel uses `/usr/bin/chromium-browser`:

```powershell
gcloud run services update mcp-registry-backend `
  --region us-central1 `
  --platform managed `
  --set-env-vars PLAYWRIGHT_CHROME_EXECUTABLE_PATH=/usr/bin/chromium-browser \
  --quiet
```

This creates revision `mcp-registry-backend-00034-krr` (or similar) and routes 100% of traffic to it. After this, the Playwright MCP server should be able to launch Chrome and process screenshot requests.

### 2. Verify Installation

After deployment, check the build logs to ensure Playwright browsers were installed:

```powershell
# Check recent build logs
gcloud builds list --limit=1

# View build logs
gcloud builds log <BUILD_ID>
```

Look for:
- `Installing Chromium` or similar messages
- No errors during `npx playwright install chromium`

### 3. Test Playwright

Try the screenshot command again:
- "take a screenshot of google.com"
- Should work without the browser error

## Alternative: Use Playwright Docker Image

If the above doesn't work, you can use the official Playwright Docker image as a base:

```dockerfile
# Use Playwright base image
FROM mcr.microsoft.com/playwright/node:18-jammy

WORKDIR /app

# ... rest of Dockerfile
```

However, this makes the image larger (~1GB vs ~500MB). The current approach (installing browsers in Alpine) is more efficient.

## Troubleshooting

### Still Getting Browser Errors?

1. **Check if browsers are installed:**
   ```powershell
   # SSH into a Cloud Run instance (if possible) or check logs
   # Look for Playwright installation messages
   ```

2. **Verify Playwright package:**
   - The `@playwright/mcp` package should be available via `npx`
   - Check that `npx @playwright/mcp@latest` works

3. **Check container size:**
   - Playwright browsers add ~200-300MB to the image
   - If the image is too small, browsers might not be included

4. **Use HTTP mode instead:**
   - Deploy Playwright as a separate HTTP service
   - See `PLAYWRIGHT_DEPLOYMENT.md` for details

## Expected Result

After redeployment:
- ✅ Playwright MCP server can launch browsers
- ✅ Screenshot commands work
- ✅ Navigation commands work
- ✅ No "browser not found" errors

## Notes

- **Image size**: Installing Playwright browsers increases the Docker image size by ~200-300MB
- **Build time**: Browser installation adds ~1-2 minutes to build time
- **Memory**: Playwright browsers use additional memory (~100-200MB per browser instance)
