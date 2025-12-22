# Playwright Invalid URL Issue

> **Note**: See also `PLAYWRIGHT_BROWSER_ARGS_ISSUE.md` for browser arguments support and consolidated status.

## Error
```
SyntaxError: browserType.launch: Invalid URL: undefined
```

## Current Status
- ✅ Backend correctly sends: `{ tool: "browser_navigate", arguments: { url: "https://google.com" } }`
- ❌ Playwright HTTP server receives `undefined` for URL parameter
- ❌ Browser launch fails before navigation

## Root Cause Analysis

### Backend Request Format
The backend sends JSON-RPC format:
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

### Expected Playwright Server Behavior
The Playwright HTTP server should:
1. Parse the JSON-RPC request
2. Extract `params.arguments.url`
3. Launch browser with that URL
4. Navigate to the URL

### Actual Behavior
The server appears to be:
1. Receiving the request ✅
2. Parsing JSON-RPC ✅
3. **Failing to extract URL from arguments** ❌
4. Trying to launch browser with `undefined` URL ❌

## Possible Causes

### 1. Parameter Parsing Issue
The Playwright HTTP server might not be correctly extracting `arguments.url` from the JSON-RPC params.

**Check**: Does the server code do:
```typescript
const url = params.arguments?.url
// vs
const url = params.arguments.url  // This would fail if arguments is undefined
```

### 2. Arguments Structure Mismatch
The server might expect a different structure:
- Expected: `{ url: "..." }`
- Received: `{ arguments: { url: "..." } }`

### 3. Browser Launch Configuration
The server might be trying to pass URL to `browser.launch()` instead of `page.goto()`:
```typescript
// WRONG:
await browser.launch({ url: params.arguments.url })  // Invalid!

// CORRECT:
const browser = await playwright.chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto(params.arguments.url)  // URL goes here
```

## Required Fix in Playwright HTTP Server

### Option 1: Fix Parameter Extraction
```typescript
// In the tools/call handler
const toolName = params.name
const toolArgs = params.arguments || {}

if (toolName === 'browser_navigate') {
  const url = toolArgs.url
  if (!url || typeof url !== 'string') {
    throw new Error('browser_navigate requires a valid URL string')
  }
  // ... navigate logic
}
```

### Option 2: Fix Browser Launch Logic
```typescript
// Ensure URL is used for navigation, not launch
const browser = await playwright.chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']  // From env var
})

const page = await browser.newPage()
const url = params.arguments.url  // Extract from arguments

if (!url) {
  throw new Error('URL is required for browser_navigate')
}

await page.goto(url)  // Navigate, don't launch with URL
```

## Testing

### Test Request Format
```powershell
$body = @{
  serverId = "com.microsoft.playwright/mcp"
  tool = "browser_navigate"
  arguments = @{ url = "https://google.com" }
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/invoke" `
  -Method POST -Body $body -ContentType "application/json"
```

### Expected JSON-RPC Format Sent to Playwright Server
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

## Related Issues
- Chrome sandbox: See `PLAYWRIGHT_CHROME_SANDBOX_FIX.md`
- Browser lock: See `PLAYWRIGHT_BROWSER_LOCK_ISSUE.md`
- Server recommendations: See `PLAYWRIGHT_HTTP_SERVER_RECOMMENDATIONS.md`

## Next Steps
1. **Playwright HTTP Server Team**: Fix parameter extraction in `tools/call` handler
2. **Verify**: Test that `params.arguments.url` is correctly extracted
3. **Ensure**: URL is used for `page.goto()`, not `browser.launch()`
4. **Test**: Verify browser navigation works after fix
