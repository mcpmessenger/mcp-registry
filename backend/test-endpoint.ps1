# Test the design generation endpoint with PowerShell

$BackendUrl = if ($env:BACKEND_URL) { $env:BACKEND_URL } else { "https://mcp-registry-backend-554655392699.us-central1.run.app" }
$ServerId = if ($env:SERVER_ID) { $env:SERVER_ID } else { "com.mcp-registry/nano-banana-mcp" }

Write-Host "🧪 Testing Design Generation Endpoint" -ForegroundColor Cyan
Write-Host "Backend URL: $BackendUrl"
Write-Host "Server ID: $ServerId"
Write-Host ""

# Test 1: Simple design request
Write-Host "📤 Test 1: Simple design request" -ForegroundColor Yellow
$body1 = @{
    description = "A simple red circle on white background"
    serverId = $ServerId
} | ConvertTo-Json

try {
    $response1 = Invoke-RestMethod -Uri "$BackendUrl/api/mcp/tools/generate" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body1
    
    Write-Host "✅ Response:" -ForegroundColor Green
    $response1 | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "---"
Write-Host ""

# Test 2: Complex design request
Write-Host "📤 Test 2: Complex design request" -ForegroundColor Yellow
$body2 = @{
    description = "Design a minimalist coffee shop poster with dark background and purple accents"
    style = "minimalist"
    colorPalette = @("purple", "dark")
    serverId = $ServerId
} | ConvertTo-Json

try {
    $response2 = Invoke-RestMethod -Uri "$BackendUrl/api/mcp/tools/generate" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body2
    
    Write-Host "✅ Response:" -ForegroundColor Green
    $response2 | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ Tests complete" -ForegroundColor Green

