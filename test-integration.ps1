# Integration Test Script
# Tests backend API and frontend integration

Write-Host "=== MCP Registry Integration Tests ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3001"
$passed = 0
$failed = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method = "GET",
        [string]$Url,
        [object]$Body = $null
    )
    
    Write-Host "Testing: $Name" -ForegroundColor Yellow
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            UseBasicParsing = $true
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.ContentType = "application/json"
            $params.Body = ($Body | ConvertTo-Json)
        }
        
        $response = Invoke-WebRequest @params
        Write-Host "  ✅ PASSED" -ForegroundColor Green
        $script:passed++
        return $response
    } catch {
        Write-Host "  ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
        return $null
    }
}

# Test 1: Health Check
Test-Endpoint -Name "Health Check" -Url "$baseUrl/health"

# Test 2: List All Servers
$serversResponse = Test-Endpoint -Name "List All Servers" -Url "$baseUrl/v0/servers"
if ($serversResponse) {
    $servers = $serversResponse.Content | ConvertFrom-Json
    Write-Host "  Found $($servers.Count) server(s)" -ForegroundColor Cyan
}

# Test 3: Get Specific Server
$encodedId = [System.Web.HttpUtility]::UrlEncode("io.github.mcpmessenger/mcp-server")
Test-Endpoint -Name "Get Specific Server" -Url "$baseUrl/v0/servers/$encodedId"

# Test 4: SVG Generation (may fail if API keys not set)
Write-Host ""
Write-Host "Testing: SVG Generation" -ForegroundColor Yellow
Write-Host "  (This requires valid Google API keys)" -ForegroundColor Gray
$generateBody = @{
    description = "minimalist icon, blue palette"
    style = "modern"
}
$generateResponse = Test-Endpoint -Name "Generate SVG" -Method "POST" -Url "$baseUrl/api/mcp/tools/generate" -Body $generateBody

if ($generateResponse) {
    $result = $generateResponse.Content | ConvertFrom-Json
    Write-Host "  Job ID: $($result.jobId)" -ForegroundColor Cyan
    
    # Test 5: Get Job Status
    Start-Sleep -Seconds 2
    Test-Endpoint -Name "Get Job Status" -Url "$baseUrl/api/mcp/tools/job/$($result.jobId)"
}

# Summary
Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "  Passed: $passed" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($failed -eq 0) {
    Write-Host "✅ All tests passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Start frontend: cd . && npm run dev" -ForegroundColor White
    Write-Host "  2. Open http://localhost:3000" -ForegroundColor White
    Write-Host "  3. Verify registry page shows servers from backend" -ForegroundColor White
} else {
    Write-Host "⚠️  Some tests failed. Check:" -ForegroundColor Yellow
    Write-Host "  - Backend server is running" -ForegroundColor White
    Write-Host "  - API keys are set in .env" -ForegroundColor White
    Write-Host "  - Database is accessible" -ForegroundColor White
}
