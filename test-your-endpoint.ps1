# Test your specific Playwright HTTP server
$ENDPOINT = "https://playwright-mcp-http-server-bvfzxpik3q-uc.a.run.app/mcp"

Write-Host "🧪 Testing Your Playwright HTTP Server" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Endpoint: $ENDPOINT" -ForegroundColor Yellow
Write-Host ""

# Test 1: Server info
Write-Host "1️⃣  Testing server info endpoint..." -ForegroundColor Cyan
try {
    $info = Invoke-RestMethod -Uri "https://playwright-mcp-http-server-bvfzxpik3q-uc.a.run.app/" -Method GET -TimeoutSec 5
    Write-Host "   ✅ Server is reachable!" -ForegroundColor Green
    Write-Host "   Name: $($info.name)" -ForegroundColor Gray
    Write-Host "   Version: $($info.version)" -ForegroundColor Gray
    Write-Host "   Protocol: $($info.protocol)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Server info failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Health check
Write-Host "2️⃣  Testing health endpoint..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "https://playwright-mcp-http-server-bvfzxpik3q-uc.a.run.app/health" -Method GET -TimeoutSec 5
    Write-Host "   ✅ Health check passed!" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor Gray
} catch {
    Write-Host "   ⚠️  Health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# Test 3: MCP Initialize
Write-Host "3️⃣  Testing MCP initialize..." -ForegroundColor Cyan
try {
    $initBody = @{
        jsonrpc = "2.0"
        id = 1
        method = "initialize"
        params = @{
            protocolVersion = "2024-11-05"
            capabilities = @{}
            clientInfo = @{
                name = "mcp-registry-test"
                version = "1.0.0"
            }
        }
    } | ConvertTo-Json -Depth 10

    $initResponse = Invoke-RestMethod -Uri $ENDPOINT -Method POST -Body $initBody -ContentType "application/json" -TimeoutSec 10
    Write-Host "   ✅ Initialize successful!" -ForegroundColor Green
    if ($initResponse.result) {
        Write-Host "   Server capabilities: $($initResponse.result.capabilities)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Initialize failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: Tools list
Write-Host "4️⃣  Testing tools/list..." -ForegroundColor Cyan
try {
    $toolsBody = @{
        jsonrpc = "2.0"
        id = 2
        method = "tools/list"
        params = @{}
    } | ConvertTo-Json -Depth 10

    $toolsResponse = Invoke-RestMethod -Uri $ENDPOINT -Method POST -Body $toolsBody -ContentType "application/json" -TimeoutSec 10
    Write-Host "   ✅ Tools list successful!" -ForegroundColor Green
    
    if ($toolsResponse.result -and $toolsResponse.result.tools) {
        $toolCount = $toolsResponse.result.tools.Count
        Write-Host "   Found $toolCount tools:" -ForegroundColor Green
        $toolsResponse.result.tools | Select-Object -First 5 | ForEach-Object {
            Write-Host "     - $($_.name)" -ForegroundColor Gray
        }
        if ($toolCount -gt 5) {
            Write-Host "     ... and $($toolCount - 5) more" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "   ❌ Tools/list failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 5: Browser navigate
Write-Host "5️⃣  Testing browser_navigate..." -ForegroundColor Cyan
try {
    $navigateBody = @{
        jsonrpc = "2.0"
        id = 3
        method = "tools/call"
        params = @{
            name = "browser_navigate"
            arguments = @{
                url = "https://example.com"
            }
        }
    } | ConvertTo-Json -Depth 10

    $navigateResponse = Invoke-RestMethod -Uri $ENDPOINT -Method POST -Body $navigateBody -ContentType "application/json" -TimeoutSec 30
    Write-Host "   ✅ Browser navigate successful!" -ForegroundColor Green
    if ($navigateResponse.result) {
        Write-Host "   Result: Navigation completed" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Browser navigate failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "✅ Testing complete!" -ForegroundColor Green
Write-Host ""
Write-Host "If all tests passed, your endpoint is WORKING!" -ForegroundColor Green
Write-Host "Next: Update the registry with this endpoint:" -ForegroundColor Yellow
Write-Host "  https://playwright-mcp-http-server-bvfzxpik3q-uc.a.run.app/mcp" -ForegroundColor Cyan
