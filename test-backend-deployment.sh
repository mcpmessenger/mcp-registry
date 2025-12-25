#!/bin/bash
# Test script for deployed backend

BACKEND_URL="https://mcp-registry-backend-554655392699.us-central1.run.app"

echo "🏥 Testing Backend Health..."
echo "URL: ${BACKEND_URL}/health"
echo ""

# Test health endpoint
curl -s "${BACKEND_URL}/health" | jq '.' || curl -s "${BACKEND_URL}/health"

echo ""
echo ""

# Test design generation endpoint (should return fallback response)
echo "🎨 Testing Design Generation Endpoint..."
echo "URL: ${BACKEND_URL}/api/mcp/tools/generate"
echo ""

curl -X POST "${BACKEND_URL}/api/mcp/tools/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Test design",
    "style": "modern",
    "size": {
      "width": 1920,
      "height": 1080
    }
  }' | jq '.' || curl -X POST "${BACKEND_URL}/api/mcp/tools/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Test design",
    "style": "modern",
    "size": {
      "width": 1920,
      "height": 1080
    }
  }'

echo ""
echo "✅ Tests complete!"

