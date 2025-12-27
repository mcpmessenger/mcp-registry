# Test Orchestrator with curl commands
# Run this script to test the Kafka orchestrator endpoint

$backendUrl = "http://localhost:3001"
$endpoint = "$backendUrl/api/orchestrator/query"

Write-Host "=== Testing Kafka Orchestrator ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Simple search query
Write-Host "Test 1: Simple search query" -ForegroundColor Yellow
$body1 = @{
    query = "when is the next iration concert in texas"
    sessionId = "test-session-$(Get-Date -Format 'yyyyMMddHHmmss')"
} | ConvertTo-Json

Write-Host "Request: POST $endpoint" -ForegroundColor Gray
Write-Host "Body: $body1" -ForegroundColor Gray
Write-Host ""

try {
    $response1 = Invoke-WebRequest -Uri $endpoint -Method POST -Body $body1 -ContentType "application/json" -UseBasicParsing
    Write-Host "Status: $($response1.StatusCode)" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Green
    $response1.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Test 2: Query with context
Write-Host "Test 2: Query with context" -ForegroundColor Yellow
$body2 = @{
    query = "find concerts in texas"
    sessionId = "test-session-$(Get-Date -Format 'yyyyMMddHHmmss')"
    contextSnapshot = @{
        previousQuery = "test"
    }
} | ConvertTo-Json -Depth 5

Write-Host "Request: POST $endpoint" -ForegroundColor Gray
Write-Host "Body: $body2" -ForegroundColor Gray
Write-Host ""

try {
    $response2 = Invoke-WebRequest -Uri $endpoint -Method POST -Body $body2 -ContentType "application/json" -UseBasicParsing
    Write-Host "Status: $($response2.StatusCode)" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Green
    $response2.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan

