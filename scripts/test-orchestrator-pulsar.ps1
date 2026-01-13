# Test Orchestrator with Pulsar (KoP or Native)
# This script tests the orchestrator endpoint with various queries

$BACKEND_URL = "http://localhost:3001"
$ENDPOINT = "$BACKEND_URL/api/orchestrator/query"

Write-Host "=== Testing Orchestrator with Pulsar ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Weather query (should route to Google Maps)
Write-Host "[Test 1] Weather query..." -ForegroundColor Yellow
$body1 = @{
    query = "what's the weather in San Francisco"
    sessionId = "test-weather-$(Get-Date -Format 'yyyyMMddHHmmss')"
} | ConvertTo-Json

try {
    $response1 = Invoke-RestMethod -Uri $ENDPOINT -Method POST -Body $body1 -ContentType "application/json"
    Write-Host "  [OK] Request ID: $($response1.requestId)" -ForegroundColor Green
    Write-Host "  [OK] Tool: $($response1.tool)" -ForegroundColor Green
    Write-Host "  [OK] Status: $($response1.status)" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Concert search (should route to Exa)
Write-Host "[Test 2] Concert search..." -ForegroundColor Yellow
$body2 = @{
    query = "when is the next iration concert in texas"
    sessionId = "test-concert-$(Get-Date -Format 'yyyyMMddHHmmss')"
} | ConvertTo-Json

try {
    $response2 = Invoke-RestMethod -Uri $ENDPOINT -Method POST -Body $body2 -ContentType "application/json"
    Write-Host "  [OK] Request ID: $($response2.requestId)" -ForegroundColor Green
    Write-Host "  [OK] Tool: $($response2.tool)" -ForegroundColor Green
    Write-Host "  [OK] Status: $($response2.status)" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: Directions query (should route to Google Maps)
Write-Host "[Test 3] Directions query..." -ForegroundColor Yellow
$body3 = @{
    query = "directions from Chicago to Milwaukee"
    sessionId = "test-directions-$(Get-Date -Format 'yyyyMMddHHmmss')"
} | ConvertTo-Json

try {
    $response3 = Invoke-RestMethod -Uri $ENDPOINT -Method POST -Body $body3 -ContentType "application/json"
    Write-Host "  [OK] Request ID: $($response3.requestId)" -ForegroundColor Green
    Write-Host "  [OK] Tool: $($response3.tool)" -ForegroundColor Green
    Write-Host "  [OK] Status: $($response3.status)" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 4: Places search (should route to Google Maps)
Write-Host "[Test 4] Places search..." -ForegroundColor Yellow
$body4 = @{
    query = "find coffee shops in des moines"
    sessionId = "test-places-$(Get-Date -Format 'yyyyMMddHHmmss')"
} | ConvertTo-Json

try {
    $response4 = Invoke-RestMethod -Uri $ENDPOINT -Method POST -Body $body4 -ContentType "application/json"
    Write-Host "  [OK] Request ID: $($response4.requestId)" -ForegroundColor Green
    Write-Host "  [OK] Tool: $($response4.tool)" -ForegroundColor Green
    Write-Host "  [OK] Status: $($response4.status)" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 5: Check orchestrator status
Write-Host "[Test 5] Orchestrator status..." -ForegroundColor Yellow
try {
    $status = Invoke-RestMethod -Uri "$BACKEND_URL/api/orchestrator/status" -Method GET
    Write-Host "  [OK] Kafka enabled: $($status.kafka.enabled)" -ForegroundColor Green
    Write-Host "  [OK] Brokers: $($status.kafka.brokers -join ', ')" -ForegroundColor Green
    Write-Host "  [OK] Matcher running: $($status.services.matcher)" -ForegroundColor Green
    Write-Host "  [OK] Coordinator running: $($status.services.coordinator)" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "If all tests passed, the orchestrator is working with Pulsar!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Check Pulsar topics: docker exec pulsar-broker bin/pulsar-admin topics list public/default" -ForegroundColor White
Write-Host "  2. Monitor logs: docker logs -f pulsar-broker" -ForegroundColor White
Write-Host "  3. See docs/PULSAR_TESTING_GUIDE.md for detailed testing" -ForegroundColor White
