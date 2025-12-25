# Update Gemini API Key for Nano Banana MCP
$serverId = "com.mcp-registry/nano-banana-mcp"
$apiKey = "AIzaSyCQeNta_oe4A-xlURzdEYZlx31-XsPIsAA"
$backendUrl = "https://mcp-registry-backend-554655392699.us-central1.run.app"

# URL encode the serverId (replace / with %2F)
$encodedServerId = $serverId -replace '/', '%2F'

Write-Host ""
Write-Host "Updating API Key for Nano Banana MCP..." -ForegroundColor Cyan
Write-Host "Server ID: $serverId" -ForegroundColor Gray
Write-Host "Encoded: $encodedServerId" -ForegroundColor Gray
Write-Host ""

try {
    # First, get the existing server to preserve other fields
    Write-Host "Fetching existing server data..." -ForegroundColor Yellow
    $existingServer = Invoke-RestMethod -Uri "${backendUrl}/v0.1/servers/${encodedServerId}" -Method GET
    
    # Update only the env field
    $body = @{
        serverId = $serverId
        name = $existingServer.name
        description = $existingServer.description
        version = $existingServer.version
        command = $existingServer.command
        args = $existingServer.args
        env = @{
            GEMINI_API_KEY = $apiKey
            API_KEY = $apiKey
        }
        tools = $existingServer.tools
        capabilities = $existingServer.capabilities
    } | ConvertTo-Json -Depth 5

    Write-Host "Sending update request..." -ForegroundColor Yellow
    
    $response = Invoke-RestMethod -Uri "${backendUrl}/v0.1/servers/${encodedServerId}" `
        -Method PUT `
        -ContentType "application/json" `
        -Body $body

    Write-Host "API Key updated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 5
    
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Try generating an image in the chat" -ForegroundColor White
    Write-Host "   2. With billing enabled, you should have higher quotas" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "Error updating API key:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
