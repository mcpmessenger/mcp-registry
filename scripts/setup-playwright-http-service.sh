#!/bin/bash
# Setup script for Playwright MCP HTTP service
# This runs Playwright in HTTP mode (separate service)

set -e

echo "🎭 Setting up Playwright MCP HTTP Service"
echo "=========================================="
echo ""

# Check if PORT is set (for platforms like Railway/Render)
PORT=${PORT:-8931}

echo "Starting Playwright MCP server on port $PORT..."
echo ""

# Start Playwright in HTTP mode
# --headless: Run browser in headless mode (required for server environments)
# --browser chromium: Use Chromium (smallest footprint)
# --no-sandbox: Required for some containerized environments
# --port: Expose HTTP endpoint
npx @playwright/mcp@latest \
  --headless \
  --browser chromium \
  --no-sandbox \
  --port $PORT

echo ""
echo "✅ Playwright MCP HTTP service is running!"
echo "   Endpoint: http://localhost:$PORT/mcp"
echo ""
echo "📝 Next steps:"
echo "   1. Update your registry agent with endpoint: http://your-host:$PORT/mcp"
echo "   2. Or set environment variable PLAYWRIGHT_ENDPOINT=http://your-host:$PORT/mcp"
echo ""
