#!/bin/bash
# Quick test script for debug endpoint

echo "Testing debug endpoint..."
echo ""
echo "1. Testing server health:"
curl -s http://localhost:3001/health | jq .
echo ""
echo ""
echo "2. Testing debug endpoint:"
curl -s http://localhost:3001/v0.1/debug/server/com.google/maps-mcp | jq .
echo ""
echo ""
echo "If you see 404, the backend needs to be restarted."
echo "Run: cd backend && npm start"

