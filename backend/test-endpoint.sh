#!/bin/bash
# Test the design generation endpoint with curl

BACKEND_URL="${BACKEND_URL:-https://mcp-registry-backend-554655392699.us-central1.run.app}"
SERVER_ID="${SERVER_ID:-com.mcp-registry/nano-banana-mcp}"

echo "🧪 Testing Design Generation Endpoint"
echo "Backend URL: $BACKEND_URL"
echo "Server ID: $SERVER_ID"
echo ""

# Test 1: Simple design request
echo "📤 Test 1: Simple design request"
curl -X POST "$BACKEND_URL/api/mcp/tools/generate" \
  -H "Content-Type: application/json" \
  -d "{
    \"description\": \"A simple red circle on white background\",
    \"serverId\": \"$SERVER_ID\"
  }" \
  -w "\n\nHTTP Status: %{http_code}\n" \
  | jq '.' 2>/dev/null || cat

echo ""
echo "---"
echo ""

# Test 2: Complex design request
echo "📤 Test 2: Complex design request"
curl -X POST "$BACKEND_URL/api/mcp/tools/generate" \
  -H "Content-Type: application/json" \
  -d "{
    \"description\": \"Design a minimalist coffee shop poster with dark background and purple accents\",
    \"style\": \"minimalist\",
    \"colorPalette\": [\"purple\", \"dark\"],
    \"serverId\": \"$SERVER_ID\"
  }" \
  -w "\n\nHTTP Status: %{http_code}\n" \
  | jq '.' 2>/dev/null || cat

echo ""
echo "✅ Tests complete"

