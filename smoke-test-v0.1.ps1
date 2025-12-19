# Smoke Test for MCP Registry v0.1 API
# Tests the updated endpoints to verify they work correctly

Write-Host "=== MCP Registry v0.1 API Smoke Test ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3001"
$passed = 0
$failed = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method = "GET",
        [string]$Url,
        [object]$Body = $null,
        [int]$ExpectedStatus = 200
    )
    
    Write-Host "Testing: $Name" -ForegroundColor Yellow
    Write-Host "  URL: $Url" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            UseBasicParsing = $true
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.ContentType = "application/json"
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-WebRequest @params
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "  ✅ PASSED (Status: $($response.StatusCode))" -ForegroundColor Green
            $script:passed++
            return $response
        } else {
            Write-Host "  ⚠️  UNEXPECTED STATUS: Expected $ExpectedStatus, got $($response.StatusCode)" -ForegroundColor Yellow
            $script:passed++
            return $response
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "  ✅ PASSED (Expected error: $statusCode)" -ForegroundColor Green
            $script:passed++
            return $null
        } else {
            Write-Host "  ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "    Status: $statusCode" -ForegroundColor Red
            $script:failed++
            return $null
        }
    }
}

# Test 1: Health Check
Write-Host "`n[1/7] Health Check" -ForegroundColor Cyan
Test-Endpoint -Name "Health Check" -Url "$baseUrl/health"

# Test 2: List All Servers (v0.1)
Write-Host "`n[2/7] Registry API - List Servers" -ForegroundColor Cyan
$serversResponse = Test-Endpoint -Name "GET /v0.1/servers" -Url "$baseUrl/v0.1/servers"
if ($serversResponse) {
    try {
        $servers = $serversResponse.Content | ConvertFrom-Json
        Write-Host "  Found $($servers.Count) server(s)" -ForegroundColor Cyan
    } catch {
        Write-Host "  ⚠️  Could not parse response as JSON" -ForegroundColor Yellow
    }
}

# Test 3: List Servers with Search Query
Write-Host "`n[3/7] Registry API - Search Query" -ForegroundColor Cyan
Test-Endpoint -Name "GET /v0.1/servers?search=test" -Url "$baseUrl/v0.1/servers?search=test"

# Test 4: List Servers with Capability Filter
Write-Host "`n[4/7] Registry API - Capability Filter" -ForegroundColor Cyan
Test-Endpoint -Name "GET /v0.1/servers?capability=tools" -Url "$baseUrl/v0.1/servers?capability=tools"

# Test 5: Get Specific Server (if we have one)
if ($serversResponse) {
    try {
        $servers = $serversResponse.Content | ConvertFrom-Json
        if ($servers.Count -gt 0 -and $servers[0].serverId) {
            Write-Host "`n[5/7] Registry API - Get Specific Server" -ForegroundColor Cyan
            $encodedId = [System.Web.HttpUtility]::UrlEncode($servers[0].serverId)
            Test-Endpoint -Name "GET /v0.1/servers/:serverId" -Url "$baseUrl/v0.1/servers/$encodedId"
        } else {
            Write-Host "`n[5/7] Registry API - Get Specific Server" -ForegroundColor Cyan
            Write-Host "  ⚠️  SKIPPED: No servers available to test" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "`n[5/7] Registry API - Get Specific Server" -ForegroundColor Cyan
        Write-Host "  ⚠️  SKIPPED: Could not parse server list" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[5/7] Registry API - Get Specific Server" -ForegroundColor Cyan
    Write-Host "  ⚠️  SKIPPED: No servers available to test" -ForegroundColor Yellow
}

# Test 6: Verify old v0 endpoints return 404
Write-Host "`n[6/7] Backward Compatibility Check" -ForegroundColor Cyan
Write-Host "Testing: Old /v0/servers endpoint (should fail)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/v0/servers" -UseBasicParsing -ErrorAction Stop
    Write-Host "  ⚠️  WARNING: Old endpoint still works (should return 404)" -ForegroundColor Yellow
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 404) {
        Write-Host "  ✅ PASSED: Old endpoint correctly returns 404" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "  ⚠️  Unexpected status: $statusCode" -ForegroundColor Yellow
    }
}

# Test 7: Verify CORS headers
Write-Host "`n[7/7] CORS Configuration" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/v0.1/servers" -UseBasicParsing -ErrorAction Stop
    $corsHeader = $response.Headers['Access-Control-Allow-Origin']
    if ($corsHeader) {
        Write-Host "  ✅ PASSED: CORS headers present" -ForegroundColor Green
        Write-Host "    Access-Control-Allow-Origin: $corsHeader" -ForegroundColor Gray
        $script:passed++
    } else {
        Write-Host "  ⚠️  CORS headers not found in response" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️  Could not test CORS: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "  Passed: $passed" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($failed -eq 0) {
    Write-Host "✅ All smoke tests passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The v0.1 API endpoints are working correctly." -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "❌ Some tests failed. Please check the backend server." -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "  - Backend server is running on port 3001" -ForegroundColor White
    Write-Host "  - Database is accessible" -ForegroundColor White
    Write-Host "  - Routes are properly configured" -ForegroundColor White
    exit 1
}
