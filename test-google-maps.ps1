# Test Google Maps MCP Server - View Full Response
# Your API key is working! This script shows the full response

$apiKey = "AIzaSyCzNv5GbUftkutYjuu7dMC8CSNv6Yrl58Y"

$headers = @{
    "Content-Type" = "application/json"
    "X-Goog-Api-Key" = $apiKey
}

$body = @{
    jsonrpc = "2.0"
    id = 1
    method = "tools/list"
    params = @{}
} | ConvertTo-Json

Write-Host "Testing Google Maps MCP Server..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "https://mapstools.googleapis.com/mcp" -Method Post -Headers $headers -Body $body
    
    Write-Host "✅ SUCCESS! Server is responding." -ForegroundColor Green
    Write-Host ""
    Write-Host "Full Response:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10
    
    Write-Host ""
    if ($response.result -and $response.result.tools) {
        Write-Host "Tools discovered: $($response.result.tools.Count)" -ForegroundColor Green
        foreach ($tool in $response.result.tools) {
            Write-Host "  ✓ $($tool.name)" -ForegroundColor Cyan
            Write-Host "    $($tool.description)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ ERROR:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
