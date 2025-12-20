# Connect Your Playwright HTTP Server

Since you've already built the Playwright HTTP server, here's how to connect it to the MCP Registry.

## Quick Setup

### Step 1: Get Your HTTP Server URL

Your Playwright HTTP server should be accessible at:
- Local: `http://localhost:8931/mcp` (or whatever port you configured)
- Deployed: `https://your-service.railway.app/mcp` (or your deployment URL)

**Important:** The endpoint path should be `/mcp` - this is where MCP protocol messages are sent.

### Step 2: Update Registry

You have two options:

#### Option A: Via UI (Easiest)

1. Go to the **Registry** page in your frontend
2. Find **"Playwright MCP Server"**
3. Click **Edit** (pencil icon)
4. In the **Endpoint** field, enter your HTTP server URL (e.g., `https://your-service.com/mcp`)
5. **Clear or remove** the `command` and `args` fields (they're not needed for HTTP mode)
6. Click **Save**

#### Option B: Via API

```bash
# Replace YOUR_ENDPOINT with your actual HTTP server URL
curl -X PUT http://localhost:3001/v0.1/servers/com.microsoft.playwright%2Fmcp \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "endpoint": "YOUR_ENDPOINT"
    },
    "command": null,
    "args": null
  }'
```

**Example:**
```bash
curl -X PUT http://localhost:3001/v0.1/servers/com.microsoft.playwright%2Fmcp \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "endpoint": "http://localhost:8931/mcp"
    }
  }'
```

### Step 3: Verify Connection

1. **Check Health Endpoint:**
   ```bash
   curl http://localhost:8931/health
   ```
   Should return: `{"status":"healthy",...}`

2. **Check MCP Endpoint:**
   ```bash
   curl -X POST http://localhost:8931/mcp \
     -H "Content-Type: application/json" \
     -d '{
       "jsonrpc": "2.0",
       "id": 1,
       "method": "tools/list",
       "params": {}
     }'
   ```
   Should return a list of available tools.

3. **Refresh Frontend:**
   - Go to the Chat page
   - Select "Playwright MCP Server" from the agent dropdown
   - Try asking for a screenshot - it should work now!

## Troubleshooting

### Error: "Agent is missing an endpoint URL"

**Fix:** Make sure you've updated the registry with your HTTP endpoint.

### Error: "Failed to invoke tool via HTTP"

**Check:**
- Is your HTTP server running?
- Is the endpoint URL correct? (should end with `/mcp`)
- Does your server support CORS? (if calling from browser)
- Check server logs for errors

### Error: "Connection refused" or "ECONNREFUSED"

**Fix:**
- Verify your HTTP server is running
- Check the port is correct
- If deployed, ensure the service is publicly accessible
- Check firewall/network settings

### Tools Still Not Available

**Fix:**
- The backend needs `command` and `args` to be null/undefined for HTTP mode
- Make sure you cleared those fields when updating
- Restart your backend server after updating

## Quick Test Script

Save this as `test-playwright-http.sh`:

```bash
#!/bin/bash

ENDPOINT="${1:-http://localhost:8931/mcp}"

echo "Testing Playwright HTTP server at: $ENDPOINT"
echo ""

# Test health
echo "1. Testing /health endpoint..."
curl -s "$ENDPOINT/../health" || curl -s "${ENDPOINT%/mcp}/health"
echo -e "\n"

# Test tools/list
echo "2. Testing tools/list..."
curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
echo -e "\n"

# Test browser_navigate
echo "3. Testing browser_navigate..."
curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "browser_navigate",
      "arguments": {
        "url": "https://example.com"
      }
    }
  }'
echo -e "\n"
```

Run it:
```bash
chmod +x test-playwright-http.sh
./test-playwright-http.sh http://your-server.com/mcp
```

## Configuration Checklist

- [ ] HTTP server is running and accessible
- [ ] Health endpoint returns 200 OK
- [ ] MCP endpoint (`/mcp`) accepts JSON-RPC requests
- [ ] Registry updated with endpoint URL
- [ ] Command and args fields cleared (for HTTP mode)
- [ ] Backend server restarted (if needed)
- [ ] Frontend refreshed
- [ ] Tested with a simple request (e.g., `browser_navigate`)

## What Happens After Setup

Once connected:

1. **Frontend** → Calls `/v0.1/invoke` with `serverId` and tool name
2. **Backend** → Detects it's an HTTP server (no `command`/`args`)
3. **Backend** → Proxies request to your HTTP server's `/mcp` endpoint
4. **Your HTTP Server** → Handles the MCP protocol message
5. **Your HTTP Server** → Returns result to backend
6. **Backend** → Returns result to frontend
7. **Frontend** → Displays the result (screenshot, navigation status, etc.)

## Need Help?

If you're having issues:
1. Check your HTTP server logs
2. Check backend logs (should show HTTP vs STDIO detection)
3. Verify the endpoint URL is correct
4. Test the HTTP server directly with curl
5. Check CORS settings if calling from browser
