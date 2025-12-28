# Test script for Memory API endpoints (PowerShell)

$BASE_URL = "http://localhost:3001"

Write-Host "🧪 Testing Memory API..." -ForegroundColor Cyan
Write-Host ""

# Wait for server to be ready
Write-Host "⏳ Waiting for server..." -ForegroundColor Yellow
for ($i = 1; $i -le 10; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "$BASE_URL/health" -UseBasicParsing -ErrorAction Stop
        Write-Host "✅ Server is ready!" -ForegroundColor Green
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}

Write-Host ""
Write-Host "1️⃣ Testing POST /api/memory/context (upsert context)" -ForegroundColor Cyan
$body1 = @{
    conversationId = "test_123"
    context = @{
        toolOutputs = @{
            navigate = @{
                url = "https://example.com"
                status = "success"
            }
        }
        conversationState = @{
            lastAction = "navigate"
            timestamp = "2025-01-19T12:00:00Z"
        }
        userPreferences = @{
            theme = "dark"
            language = "en"
        }
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/memory/context" -Method POST -Body $body1 -ContentType "application/json"
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    $_.Exception.Response | Select-Object StatusCode, StatusDescription
}

Write-Host ""
Write-Host ""
Write-Host "2️⃣ Testing POST /api/memory (store individual memory)" -ForegroundColor Cyan
$body2 = @{
    conversationId = "test_123"
    type = "fact"
    key = "user_favorite_color"
    value = "blue"
    importance = 7
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/memory" -Method POST -Body $body2 -ContentType "application/json"
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host ""
Write-Host "3️⃣ Testing GET /api/memory (get memories)" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/memory?conversationId=test_123" -Method GET
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host ""
Write-Host "4️⃣ Testing POST /api/memory/search (search history)" -ForegroundColor Cyan
$body4 = @{
    conversationId = "test_123"
    query = "navigate"
    limit = 10
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/memory/search" -Method POST -Body $body4 -ContentType "application/json"
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host ""
Write-Host "✅ All tests complete!" -ForegroundColor Green
















