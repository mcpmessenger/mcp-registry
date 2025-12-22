# Test Playwright MCP Server Invocation
# This helps diagnose why the invoke request is pending

$backendUrl = "https://mcp-registry-backend-554655392699.us-central1.run.app"
$serverId = "com.microsoft.playwright/mcp"

Write-Host "Testing Playwright MCP Server Invocation" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check server registration
Write-Host "1. Checking server registration..." -ForegroundColor Yellow
try {
    $encodedServerId = [System.Uri]::EscapeDataString($serverId)
    $server = Invoke-RestMethod -Uri "$backendUrl/v0.1/servers/$encodedServerId" -Method GET -TimeoutSec 10
    Write-Host "   SUCCESS: Server is registered" -ForegroundColor Green
    Write-Host "   Command: $($server.command)" -ForegroundColor Gray
    Write-Host "   Args: $($server.args -join ' ')" -ForegroundColor Gray
} catch {
    Write-Host "   ERROR: Server not found: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Try to invoke browser_navigate (simple operation)
Write-Host "2. Testing browser_navigate tool..." -ForegroundColor Yellow
Write-Host "   This will try to navigate to wikipedia.com" -ForegroundColor Gray
Write-Host "   WARNING: This may take 2-3 minutes if Playwright needs to launch browser" -ForegroundColor Yellow
Write-Host ""

$body = @{
    serverId = $serverId
    tool = "browser_navigate"
    arguments = @{
        url = "https://wikipedia.com"
    }
} | ConvertTo-Json

try {
    $startTime = Get-Date
    Write-Host "   Sending request at $(Get-Date -Format 'HH:mm:ss')..." -ForegroundColor Gray
    
    $response = Invoke-RestMethod -Uri "$backendUrl/v0.1/invoke" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 180 `
        -ErrorAction Stop
    
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    Write-Host "   SUCCESS! (took $([math]::Round($duration, 1))s)" -ForegroundColor Green
    Write-Host "   Response: $($response | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
} catch {
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    Write-Host "   FAILED after $([math]::Round($duration, 1))s" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Possible causes:" -ForegroundColor Yellow
    Write-Host "   1. Playwright browser launch timeout (GPU issue)" -ForegroundColor White
    Write-Host "   2. Backend timeout (check Cloud Run logs)" -ForegroundColor White
    Write-Host "   3. Network connectivity issue" -ForegroundColor White
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "   - Check Cloud Run logs for detailed error messages" -ForegroundColor White
Write-Host "   - If timeout: See docs/PLAYWRIGHT_GPU_FIX.md" -ForegroundColor White
Write-Host "   - If server error: Check backend deployment status" -ForegroundColor White
Write-Host ""
