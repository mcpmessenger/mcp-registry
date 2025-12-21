# PowerShell setup script for Playwright MCP HTTP service
# This runs Playwright in HTTP mode (separate service)

$ErrorActionPreference = "Stop"

Write-Host "🎭 Setting up Playwright MCP HTTP Service" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if PORT is set (for platforms like Railway/Render)
$port = if ($env:PORT) { $env:PORT } else { "8931" }

Write-Host "Starting Playwright MCP server on port $port..." -ForegroundColor Yellow
Write-Host ""

# Start Playwright in HTTP mode
# --headless: Run browser in headless mode (required for server environments)
# --browser chromium: Use Chromium (smallest footprint)
# --no-sandbox: Required for some containerized environments
# --port: Expose HTTP endpoint
npx @playwright/mcp@latest `
  --headless `
  --browser chromium `
  --no-sandbox `
  --port $port

Write-Host ""
Write-Host "✅ Playwright MCP HTTP service is running!" -ForegroundColor Green
Write-Host "   Endpoint: http://localhost:$port/mcp" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Update your registry agent with endpoint: http://your-host:$port/mcp"
Write-Host "   2. Or set environment variable PLAYWRIGHT_ENDPOINT=http://your-host:$port/mcp"
Write-Host ""
