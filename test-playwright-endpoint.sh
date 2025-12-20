#!/bin/bash
# Test script for Playwright HTTP server endpoint
# Usage: ./test-playwright-endpoint.sh <endpoint-url>
# Example: ./test-playwright-endpoint.sh http://localhost:8931/mcp

ENDPOINT="${1:-http://localhost:8931/mcp}"

echo "🧪 Testing Playwright HTTP Server Endpoint"
echo "========================================="
echo ""
echo "Endpoint: $ENDPOINT"
echo ""

# Test 1: Health check
echo "1️⃣  Testing connectivity..."
HEALTH_URL=$(echo "$ENDPOINT" | sed 's|/mcp$|/health|')
if curl -s -f -m 5 "$HEALTH_URL" > /dev/null 2>&1; then
    echo "   ✅ Health endpoint reachable"
    curl -s "$HEALTH_URL" | head -c 200
    echo ""
else
    echo "   ⚠️  Health endpoint not found (this is okay if not implemented)"
fi
echo ""

# Test 2: MCP initialize
echo "2️⃣  Testing MCP initialize..."
INIT_RESPONSE=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "mcp-registry-test",
        "version": "1.0.0"
      }
    }
  }' 2>&1)

if echo "$INIT_RESPONSE" | grep -q "result\|error"; then
    echo "   ✅ Initialize response received"
    echo "   Response: $(echo "$INIT_RESPONSE" | head -c 300)"
else
    echo "   ❌ Initialize failed"
    echo "   Error: $INIT_RESPONSE"
fi
echo ""

# Test 3: Tools list
echo "3️⃣  Testing tools/list..."
TOOLS_RESPONSE=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }' 2>&1)

if echo "$TOOLS_RESPONSE" | grep -q "result\|error"; then
    echo "   ✅ Tools list response received"
    TOOL_COUNT=$(echo "$TOOLS_RESPONSE" | grep -o '"name"' | wc -l)
    echo "   Found approximately $TOOL_COUNT tools"
    echo "   Response preview: $(echo "$TOOLS_RESPONSE" | head -c 500)"
else
    echo "   ❌ Tools/list failed"
    echo "   Error: $TOOLS_RESPONSE"
fi
echo ""

# Test 4: Browser navigate
echo "4️⃣  Testing browser_navigate..."
NAV_RESPONSE=$(curl -s -X POST "$ENDPOINT" \
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
  }' 2>&1)

if echo "$NAV_RESPONSE" | grep -q "result\|error"; then
    echo "   ✅ Browser navigate response received"
    echo "   Response preview: $(echo "$NAV_RESPONSE" | head -c 300)"
else
    echo "   ❌ Browser navigate failed"
    echo "   Error: $NAV_RESPONSE"
fi
echo ""

echo "========================================="
echo "✅ Testing complete!"
echo ""
echo "If all tests passed, your endpoint is working!"
echo "You can now update the registry with this endpoint."
