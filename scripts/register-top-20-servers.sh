#!/bin/bash

# Register Top 20 MCP Servers
# This script runs the TypeScript registration script from the backend directory

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"

echo "🚀 Registering top 20 MCP servers..."
echo ""

cd "$BACKEND_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Run the registration script
npm run register-top-20

echo ""
echo "✅ Done!"

