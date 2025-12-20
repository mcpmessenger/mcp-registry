# PowerShell script to test Playwright HTTP server endpoint
# Usage: .\test-playwright-endpoint.ps1 <endpoint-url>
# Example: .\test-playwright-endpoint.ps1 http://localhost:8931/mcp

param(
    [string]$Endpoint = "http://localhost:8931/mcp"
)

Write-Host "🧪 Testing Playwright HTTP Server Endpoint" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Endpoint: $Endpoint" -ForegroundColor Yellow
Write-Host ""

# Test 1: Check if server is reachable
Write-Host "1️⃣  Testing connectivity..." -ForegroundColor Cyan
try {
    $healthUrl = $Endpoint -replace "/mcp$", "/health"
    $healthResponse = Invoke-WebRequest -Uri $healthUrl -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✅ Health endpoint reachable (Status: $($healthResponse.StatusCode))" -ForegroundColor Green
    Write-Host "   Response: $($healthResponse.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   ⚠️  Health endpoint not found or unreachable" -ForegroundColor Yellow
    Write-Host "   (This is okay if health endpoint isn't implemented)" -ForegroundColor Gray
}
Write-Host ""

# Test 2: Test MCP initialize
Write-Host "2️⃣  Testing MCP initialize..." -ForegroundColor Cyan
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

    $initResponse = Invoke-RestMethod -Uri $Endpoint -Method POST -Body $initBody -ContentType "application/json" -TimeoutSec 10
    Write-Host "   ✅ Initialize successful" -ForegroundColor Green
    Write-Host "   Response: $($initResponse | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Initialize failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Red
    }
}
Write-Host ""

# Test 3: Test tools/list
Write-Host "3️⃣  Testing tools/list..." -ForegroundColor Cyan
try {
    $toolsBody = @{
        jsonrpc = "2.0"
        id = 2
        method = "tools/list"
        params = @{}
    } | ConvertTo-Json -Depth 10

    $toolsResponse = Invoke-RestMethod -Uri $Endpoint -Method POST -Body $toolsBody -ContentType "application/json" -TimeoutSec 10
    Write-Host "   ✅ Tools list successful" -ForegroundColor Green
    
    if ($toolsResponse.result -and $toolsResponse.result.tools) {
        $toolCount = $toolsResponse.result.tools.Count
        Write-Host "   Found $toolCount tools:" -ForegroundColor Green
        $toolsResponse.result.tools | ForEach-Object {
            Write-Host "     - $($_.name)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ⚠️  No tools found in response" -ForegroundColor Yellow
    }
    Write-Host "   Full response: $($toolsResponse | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Tools/list failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Red
    }
}
Write-Host ""

# Test 4: Test browser_navigate
Write-Host "4️⃣  Testing browser_navigate..." -ForegroundColor Cyan
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

    $navigateResponse = Invoke-RestMethod -Uri $Endpoint -Method POST -Body $navigateBody -ContentType "application/json" -TimeoutSec 30
    Write-Host "   ✅ Browser navigate successful" -ForegroundColor Green
    Write-Host "   Response: $($navigateResponse | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Browser navigate failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Red
    }
}
Write-Host ""

# Summary
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "✅ Testing complete!" -ForegroundColor Green
Write-Host ""
Write-Host "If all tests passed, your endpoint is working!" -ForegroundColor Green
Write-Host "You can now update the registry with this endpoint." -ForegroundColor Green
