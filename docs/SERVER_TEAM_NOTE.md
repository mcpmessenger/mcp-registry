# Quick Note for Playwright Server Team

**Date**: December 22, 2024  
**Priority**: High  
**Status**: Two Critical Issues Blocking Browser Operations

---

## Summary

We've tested the updated Playwright HTTP server and found **two issues** that are preventing browser operations from working:

1. **URL Parameter Extraction** - Browser navigation fails
2. **Browser Arguments Not Applied** - Chrome can't run in Cloud Run environment

---

## Issue 1: URL Parameter Extraction ❌

### Problem
Browser navigation fails with: `SyntaxError: browserType.launch: Invalid URL: undefined`

### What We're Sending
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "browser_navigate",
    "arguments": {
      "url": "https://google.com"
    }
  }
}
```

### What's Happening
- ✅ Server receives the request correctly
- ✅ URL is in `params.arguments.url`
- ❌ Server extracts `undefined` instead of the URL
- ❌ Browser launch fails

### Required Fix
```typescript
// In tools/call handler
const url = params.arguments?.url
if (!url || typeof url !== 'string') {
  throw new Error('browser_navigate requires a valid URL string')
}
// Use url for page.goto(), NOT browser.launch()
```

---

## Issue 2: Browser Arguments Not Applied ❌

### Problem
Chrome fails to launch: `Running as root without --no-sandbox is not supported`

### Configuration
Environment variable is set:
```
PLAYWRIGHT_BROWSER_ARGS=--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu
```

### What's Happening
- ✅ Environment variable is configured in Cloud Run
- ❌ Server code is not reading `PLAYWRIGHT_BROWSER_ARGS`
- ❌ Chrome launches without `--no-sandbox` flag
- ❌ Chrome crashes immediately

### Required Fix
```typescript
// Read browser args from environment
const browserArgs = process.env.PLAYWRIGHT_BROWSER_ARGS?.split(' ').filter(Boolean) || []

const browser = await playwright.chromium.launch({
  headless: true,
  args: [
    ...browserArgs,  // Add custom args first
    // ... other default args
  ]
})
```

---

## Test Evidence

### Direct Server Test
```bash
POST https://playwright-mcp-http-server-554655392699.us-central1.run.app/mcp
```

**Response**: Still shows both errors

### Server Logs Show
- Request received correctly: `{"arguments":{"url":"https://google.com"},"name":"browser_navigate"}`
- Chrome launch fails: No `--no-sandbox` in launch args
- Error: `Invalid URL: undefined`

---

## Impact

**Current Status**: ❌ **Browser operations completely blocked**

- Browser navigation: ❌ Fails
- Screenshots: ❌ Fails  
- All browser tools: ❌ Failing

**User Impact**: Playwright MCP server is unusable in production

---

## Quick Fix Checklist

- [ ] Fix URL extraction: `params.arguments?.url`
- [ ] Read `PLAYWRIGHT_BROWSER_ARGS` env var
- [ ] Apply browser args to `browser.launch()`
- [ ] Use URL for `page.goto()`, not `browser.launch()`
- [ ] Test with: `browser_navigate` to `https://google.com`
- [ ] Verify Chrome launches with `--no-sandbox`

---

## Test After Fix

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

**Expected**: Success response with navigation result  
**Current**: Error with "Invalid URL: undefined"

---

## Questions?

- Check logs: `gcloud logging read "resource.labels.service_name=playwright-mcp-http-server" --limit=20`
- Verify env vars: `gcloud run services describe playwright-mcp-http-server --region=us-central1`
- Test endpoint: See test command above

---

**Thanks for the quick turnaround!** These two fixes will unblock browser operations completely.





