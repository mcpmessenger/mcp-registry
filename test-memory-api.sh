#!/bin/bash
# Test script for Memory API endpoints

BASE_URL="http://localhost:3001"

echo "🧪 Testing Memory API..."
echo ""

# Wait for server to be ready
echo "⏳ Waiting for server..."
for i in {1..10}; do
  if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo "✅ Server is ready!"
    break
  fi
  sleep 1
done

echo ""
echo "1️⃣ Testing POST /api/memory/context (upsert context)"
curl -X POST "$BASE_URL/api/memory/context" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "test_123",
    "context": {
      "toolOutputs": {
        "navigate": {
          "url": "https://example.com",
          "status": "success"
        }
      },
      "conversationState": {
        "lastAction": "navigate",
        "timestamp": "2025-01-19T12:00:00Z"
      },
      "userPreferences": {
        "theme": "dark",
        "language": "en"
      }
    }
  }' | jq '.'

echo ""
echo ""
echo "2️⃣ Testing POST /api/memory (store individual memory)"
curl -X POST "$BASE_URL/api/memory" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "test_123",
    "type": "fact",
    "key": "user_favorite_color",
    "value": "blue",
    "importance": 7
  }' | jq '.'

echo ""
echo ""
echo "3️⃣ Testing GET /api/memory (get memories)"
curl -X GET "$BASE_URL/api/memory?conversationId=test_123" | jq '.'

echo ""
echo ""
echo "4️⃣ Testing POST /api/memory/search (search history)"
curl -X POST "$BASE_URL/api/memory/search" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "test_123",
    "query": "navigate",
    "limit": 10
  }' | jq '.'

echo ""
echo ""
echo "✅ All tests complete!"
