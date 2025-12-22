# Register and Test MCP Servers (Playwright & LangChain)
# This script registers the official MCP servers and verifies they work

Write-Host "=== MCP Server Registration & Testing ===" -ForegroundColor Cyan
Write-Host ""

# Check if backend directory exists
if (-not (Test-Path "backend")) {
    Write-Host "❌ Backend directory not found. Run this from the project root." -ForegroundColor Red
    exit 1
}

# Step 1: Register official servers
Write-Host "📝 Step 1: Registering official MCP servers..." -ForegroundColor Yellow
Set-Location backend

try {
    npm run register-official
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Registration failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Servers registered successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Error during registration: $_" -ForegroundColor Red
    exit 1
}

Set-Location ..

Write-Host ""
Write-Host "🧪 Step 2: Testing server registration..." -ForegroundColor Yellow

# Test if backend is running
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/health" -ErrorAction Stop
    Write-Host "✅ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Backend is not running. Start it with: cd backend; npm start" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📖 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Start backend: cd backend; npm start" -ForegroundColor White
    Write-Host "   2. Start frontend: npm run dev" -ForegroundColor White
    Write-Host "   3. Go to http://localhost:3000/chat" -ForegroundColor White
    Write-Host "   4. Select 'Playwright MCP Server' or 'LangChain Agent MCP Server'" -ForegroundColor White
    exit 0
}

# Test server list
try {
    $servers = Invoke-RestMethod -Uri "http://localhost:3001/v0.1/servers" -ErrorAction Stop
    Write-Host "✅ Found $($servers.Count) server(s) in registry" -ForegroundColor Green
    
    $playwright = $servers | Where-Object { $_.serverId -eq "com.microsoft.playwright/mcp" }
    $langchain = $servers | Where-Object { $_.serverId -eq "langchain-agent-mcp-server" }
    
    if ($playwright) {
        Write-Host "   ✅ Playwright MCP Server registered" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Playwright MCP Server not found" -ForegroundColor Yellow
    }
    
    if ($langchain) {
        Write-Host "   ✅ LangChain Agent MCP Server registered" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  LangChain Agent MCP Server not found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to fetch servers: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "✨ Registration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📖 Full guide: docs/REGISTER_AND_TEST_MCP_SERVERS.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "🧪 To test in frontend:" -ForegroundColor Yellow
Write-Host "   1. Start frontend: npm run dev" -ForegroundColor White
Write-Host "   2. Go to http://localhost:3000/chat" -ForegroundColor White
Write-Host "   3. Select an agent and try:" -ForegroundColor White
Write-Host "      - Playwright: 'Take a screenshot of google.com'" -ForegroundColor Gray
Write-Host "      - LangChain: 'What are the key features of React?'" -ForegroundColor Gray
