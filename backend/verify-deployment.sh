#!/bin/bash

# Verify backend deployment
BACKEND_URL="https://mcp-registry-backend-554655392699.us-central1.run.app"

echo "🔍 Verifying backend deployment..."
echo ""

# Test health endpoint
echo "1. Testing health endpoint..."
curl -s "${BACKEND_URL}/health" | jq . || echo "❌ Health check failed"
echo ""

# Test generate endpoint (should return error about missing description, not 500)
echo "2. Testing generate endpoint (expecting validation error)..."
curl -s -X POST "${BACKEND_URL}/api/mcp/tools/generate" \
  -H "Content-Type: application/json" \
  -d '{}' | jq . || echo "❌ Generate endpoint failed"
echo ""

echo "✅ If you see JSON responses above, the deployment is working!"
echo ""
echo "📋 Next steps:"
echo "   1. Update Gemini API key in Nano Banana MCP server registration"
echo "   2. Test design generation in the chat interface"

