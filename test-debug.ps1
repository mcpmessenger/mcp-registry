# PowerShell script to test debug endpoint
# Run this AFTER restarting the backend server

Write-Host "Testing debug endpoint..." -ForegroundColor Cyan
Write-Host ""

$response = Invoke-WebRequest -Uri "http://localhost:3001/v0.1/debug/server/com.google/maps-mcp" -Method GET -UseBasicParsing -ErrorAction SilentlyContinue

if ($response.StatusCode -eq 200) {
    Write-Host "✅ SUCCESS! Debug endpoint is working!" -ForegroundColor Green
    Write-Host ""
    $json = $response.Content | ConvertFrom-Json
    $json | ConvertTo-Json -Depth 10
} else {
    Write-Host "❌ FAILED - Status Code: $($response.StatusCode)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure the backend server has been restarted!" -ForegroundColor Yellow
    Write-Host "Run: cd backend && npm start" -ForegroundColor Yellow
}

