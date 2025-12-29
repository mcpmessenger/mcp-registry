# Register Top 20 MCP Servers
# PowerShell script to register the top 20 MCP servers

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir "..\backend"

Write-Host "🚀 Registering top 20 MCP servers..." -ForegroundColor Cyan
Write-Host ""

Set-Location $BackendDir

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Run the registration script
npm run register-top-20

Write-Host ""
Write-Host "✅ Done!" -ForegroundColor Green

