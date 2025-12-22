# Playwright Browser Lock Issue - Root Cause & Solution

## Current Status
✅ **Backend is working** - No more 401 errors, HTTP communication is functional  
⚠️ **Browser lock error persists** - "Browser is already in use" when calling `browser_navigate`

## Root Cause
The Playwright HTTP server (`mcpmessenger/playwright-mcp`) uses a **shared browser instance** across requests. When a browser operation doesn't fully complete or close, subsequent requests fail with:
```
Error: Browser is already in use for /root/.cache/ms-playwright/mcp-chrome, use --isolated to run multiple instances of the same browser
```

## What We've Tried
1. ✅ Removed auth requirement (Playwright HTTP server now open)
2. ✅ Added MCP session initialization
3. ✅ Added `browser_close` before `browser_navigate` (workaround)
4. ⚠️ Browser lock still occurs - needs fix in Playwright HTTP server

## Required Fix
The Playwright HTTP server (`mcpmessenger/playwright-mcp` repository) needs to be updated to:

### Option 1: Use Isolated Browser Instances (Recommended)
Modify `src/playwright-process.ts` to pass `--isolated` flag when launching browsers:

```typescript
// In playwright-process.ts, modify browser launch to use isolated instances
const proc = spawn("npx", ["-y", "@playwright/mcp@latest", "--isolated"], {
  stdio: ["pipe", "pipe", "pipe"],
  shell: process.platform === "win32",
});
```

### Option 2: Properly Close Browser Between Requests
Ensure `browser_close` actually terminates the browser process, not just the page.

### Option 3: Use Browser Tabs API
Use `browser_tabs` tool to manage multiple contexts instead of reusing a single browser instance.

## Current Workaround
The backend now attempts to close the browser before `browser_navigate`, but this doesn't fully resolve the lock issue because the browser process itself remains locked.

## Next Steps
1. **Update Playwright HTTP Server**: Modify `mcpmessenger/playwright-mcp` to support isolated browser instances
2. **Or**: Configure the server to properly clean up browser processes between requests
3. **Or**: Use browser tabs for concurrent operations

## Testing
Once the Playwright HTTP server is updated, test with:
```powershell
$body = @{
  serverId = "com.microsoft.playwright/mcp"
  tool = "browser_navigate"
  arguments = @{ url = "https://google.com" }
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/invoke" `
  -Method POST -Body $body -ContentType "application/json"
```

This should work without browser lock errors once the Playwright HTTP server is fixed.
