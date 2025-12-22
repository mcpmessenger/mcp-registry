# Playwright Browser Arguments Support & URL Parameter Issue

**Date**: January 2025  
**Status**: Browser Arguments Supported ✅ | URL Parameter Issue ⚠️  
**Priority**: Medium

---

## Browser Arguments Support ✅

The Playwright MCP HTTP Server now supports custom browser launch arguments via the `PLAYWRIGHT_BROWSER_ARGS` environment variable. This enables proper browser operation in containerized environments like Cloud Run.

### Configuration

Server administrators can configure browser launch arguments via environment variable:

```bash
PLAYWRIGHT_BROWSER_ARGS=--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu
```

### Cloud Run Deployment

```bash
gcloud run services update playwright-mcp-http-server \
  --update-env-vars "PLAYWRIGHT_BROWSER_ARGS=--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu" \
  --region=us-central1
```

### Recommended Browser Arguments for Cloud Run

- `--no-sandbox` - Required for running Chrome as root (Cloud Run default)
- `--disable-setuid-sandbox` - Additional sandbox disable flag
- `--disable-dev-shm-usage` - Overcome limited `/dev/shm` in containers
- `--disable-gpu` - Disable GPU (not available in Cloud Run)

---

## URL Parameter Extraction Issue ⚠️

### Error
```
SyntaxError: browserType.launch: Invalid URL: undefined
```

### Root Cause
There is a known issue with URL parameter extraction in the `@playwright/mcp` package (external dependency). The Playwright HTTP server is not correctly extracting the URL from `params.arguments.url` when handling `browser_navigate` tool calls.

### Impact
- Browser navigation fails with "Invalid URL: undefined"
- Screenshot and other browser operations may also fail
- **Status**: Being tracked - requires fix in `@playwright/mcp` package

### Current Behavior
1. Backend correctly sends JSON-RPC request:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1234567890,
     "method": "tools/call",
     "params": {
       "name": "browser_navigate",
       "arguments": {
         "url": "https://google.com"
       }
     }
   }
   ```

2. Playwright HTTP server receives request ✅

3. **Server fails to extract `params.arguments.url`** ❌

4. Browser launch attempted with `undefined` URL ❌

### Expected Fix
The Playwright HTTP server should:
1. Extract URL from `params.arguments.url`
2. Validate URL is present and is a string
3. Use URL for `page.goto()`, not `browser.launch()`

**Example fix**:
```typescript
// In tools/call handler
const toolName = params.name
const toolArgs = params.arguments || {}

if (toolName === 'browser_navigate') {
  const url = toolArgs.url
  if (!url || typeof url !== 'string') {
    throw new Error('browser_navigate requires a valid URL string')
  }
  
  const browser = await playwright.chromium.launch({
    headless: true,
    args: process.env.PLAYWRIGHT_BROWSER_ARGS?.split(' ') || []
  })
  
  const page = await browser.newPage()
  await page.goto(url)  // Use URL here, not in launch()
}
```

### Workaround
**None available at this time.** This requires a fix in the Playwright HTTP server code.

---

## Testing

### Test Browser Arguments Support
After configuring `PLAYWRIGHT_BROWSER_ARGS`, verify browser can launch:

```bash
curl -X POST https://playwright-mcp-http-server-554655392699.us-central1.run.app/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "browser_navigate",
      "arguments": {
        "url": "https://google.com"
      }
    }
  }'
```

### Expected Results
- ✅ Browser arguments: Browser should launch without sandbox errors
- ⚠️ URL parameter: May still fail with "Invalid URL: undefined" until fix is applied

---

## Related Documentation

- Browser lock issue: See `PLAYWRIGHT_BROWSER_LOCK_ISSUE.md`
- Invalid URL details: See `PLAYWRIGHT_INVALID_URL_ISSUE.md`
- Security recommendations: See `PLAYWRIGHT_HTTP_SERVER_RECOMMENDATIONS.md`
- Chrome sandbox fix: See `PLAYWRIGHT_CHROME_SANDBOX_FIX.md`

---

## Status Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Browser Arguments Support | ✅ Working | Configure via `PLAYWRIGHT_BROWSER_ARGS` env var |
| URL Parameter Extraction | ⚠️ Needs Fix | Issue in `@playwright/mcp` package |
| Browser Launch | ✅ Working | With proper browser args |
| Browser Navigation | ❌ Failing | Due to URL parameter issue |

---

**Note**: Browser arguments support is working. The URL parameter extraction issue is a separate bug that needs to be fixed in the Playwright HTTP server code.
