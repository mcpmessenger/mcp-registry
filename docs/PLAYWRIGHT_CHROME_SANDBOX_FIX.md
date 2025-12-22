# Playwright Chrome Sandbox Fix

## Issue
Playwright Chrome browser fails to launch in Cloud Run with error:
```
Running as root without --no-sandbox is not supported. See https://crbug.com/638180.
SyntaxError: browserType.launch: Invalid URL: undefined
```

## Root Cause
1. **Sandbox Issue**: Chrome cannot run as root without `--no-sandbox` flag (Cloud Run runs containers as root)
2. **Invalid URL**: The URL parameter may not be passed correctly to the browser launch

## Solution

### Option 1: Environment Variables (Applied ✅)
Added browser launch arguments via environment variables:

```bash
gcloud run services update playwright-mcp-http-server \
  --update-env-vars "PLAYWRIGHT_BROWSER_ARGS=--no-sandbox --disable-setuid-sandbox" \
  --region=us-central1
```

**Note**: The Playwright HTTP server code needs to be updated to actually use this environment variable. Currently set, but server code must read `PLAYWRIGHT_BROWSER_ARGS` and pass it to browser launch.

### Option 2: Update Playwright HTTP Server Code (Recommended)
Modify the Playwright HTTP server to automatically add `--no-sandbox` when running in containerized environments:

```typescript
// In playwright-process.ts or browser launch code
const browserArgs = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage', // Overcome limited resource problems
  ...(process.env.PLAYWRIGHT_BROWSER_ARGS?.split(',') || [])
]

const browser = await playwright.chromium.launch({
  headless: true,
  args: browserArgs,
})
```

### Option 3: Use Non-Root User (Best Practice)
Update Dockerfile to run as non-root user:

```dockerfile
# Create non-root user
RUN useradd -m -u 1000 playwright
USER playwright

# Or use Playwright's built-in user
RUN npx playwright install-deps chromium
```

## Testing
After applying the fix, test with:
```powershell
$body = @{
  serverId = "com.microsoft.playwright/mcp"
  tool = "browser_navigate"
  arguments = @{ url = "https://google.com" }
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/invoke" `
  -Method POST -Body $body -ContentType "application/json"
```

## Additional Chrome Flags for Cloud Run
For better stability in Cloud Run, consider adding:
- `--no-sandbox` - Required for root execution
- `--disable-setuid-sandbox` - Additional sandbox disable
- `--disable-dev-shm-usage` - Overcome limited /dev/shm
- `--disable-gpu` - Disable GPU (not available in Cloud Run)
- `--single-process` - Run in single process (may help with resource limits)

## Related Issues
- Browser lock issue: See `PLAYWRIGHT_BROWSER_LOCK_ISSUE.md`
- Security recommendations: See `PLAYWRIGHT_HTTP_SERVER_RECOMMENDATIONS.md`
