# Quick Test: Is Your Playwright Endpoint Working?

Run these tests to check if your HTTP server endpoint is working.

## Quick PowerShell Test (Windows)

```powershell
.\test-playwright-endpoint.ps1 http://your-server.com/mcp
```

## Quick Bash Test (Mac/Linux)

```bash
chmod +x test-playwright-endpoint.sh
./test-playwright-endpoint.sh http://your-server.com/mcp
```

## Manual Tests

### Test 1: Health Check (Optional)

```bash
curl http://your-server.com/health
```

**Expected:** `{"status":"healthy",...}` or 404 (if not implemented - that's okay)

### Test 2: MCP Initialize

```bash
curl -X POST http://your-server.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test",
        "version": "1.0.0"
      }
    }
  }'
```

**Expected:** JSON response with `result` containing server info

### Test 3: List Tools

```bash
curl -X POST http://your-server.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

**Expected:** JSON response with `result.tools` array containing Playwright tools

### Test 4: Navigate to URL

```bash
curl -X POST http://your-server.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "browser_navigate",
      "arguments": {
        "url": "https://example.com"
      }
    }
  }'
```

**Expected:** JSON response with `result` containing navigation success

## Common Issues

### "Connection refused" or "ECONNREFUSED"
- ❌ Server is not running
- **Fix:** Start your HTTP server

### "404 Not Found"
- ❌ Wrong endpoint path
- **Fix:** Make sure path is `/mcp` (e.g., `http://localhost:8931/mcp`)

### "500 Internal Server Error"
- ❌ Server error (check server logs)
- **Fix:** Check your server logs for errors

### "Timeout" or "ETIMEDOUT"
- ❌ Server is slow or not responding
- **Fix:** Check server logs, verify it's processing requests

### Empty response or no response
- ❌ Server might not be handling requests correctly
- **Fix:** Check your server implementation, ensure it's reading from stdin correctly

## What "Working" Looks Like

✅ Health endpoint returns 200 OK (or doesn't exist - that's fine)  
✅ Initialize returns JSON with `result`  
✅ Tools/list returns JSON with `result.tools` array  
✅ Browser_navigate returns JSON with `result` showing success

If all these pass, your endpoint is **WORKING** ✅

If any fail, your endpoint is **BUSTED** ❌ - check server logs for errors.
