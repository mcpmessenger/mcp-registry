# Update Google Maps MCP server with tools via backend API
$backendUrl = "https://mcp-registry-backend-554655392699.us-central1.run.app"
$serverId = "com.google/maps-mcp"

$updateData = @{
    serverId = "com.google/maps-mcp"
    name = "Google Maps MCP (Grounding Lite)"
    description = "Google Maps Platform MCP server (Grounding Lite). Requires X-Goog-Api-Key header configured in the registry HTTP headers."
    version = "0.1.0"
    env = @{}
    tools = @(
        @{
            name = "search_places"
            description = "Search places by text query"
            inputSchema = @{
                type = "object"
                properties = @{
                    text_query = @{
                        type = "string"
                        description = "Primary search text, e.g., tacos in des moines"
                    }
                    location_bias = @{
                        type = "object"
                        description = "Optional bias region (see Maps Grounding Lite docs)"
                    }
                }
                required = @("text_query")
            }
        }
    )
    capabilities = @("tools")
    manifest = @{
        name = "Google Maps MCP"
        version = "0.1.0"
        endpoint = "https://mapstools.googleapis.com/mcp"
        tools = @(
            @{
                name = "search_places"
                description = "Search places by text query"
                inputSchema = @{
                    type = "object"
                    properties = @{
                        text_query = @{
                            type = "string"
                            description = "Primary search text, e.g., tacos in des moines"
                        }
                        location_bias = @{
                            type = "object"
                            description = "Optional bias region (see Maps Grounding Lite docs)"
                        }
                    }
                    required = @("text_query")
                }
            }
        )
        capabilities = @("tools")
    }
    metadata = @{
        source = "official"
        publisher = "Google"
        documentation = "https://developers.google.com/maps/ai/grounding-lite"
        endpoint = "https://mapstools.googleapis.com/mcp"
        notes = "Set HTTP Headers in registry to {""X-Goog-Api-Key"":""YOUR_KEY""}"
    }
}

Write-Host "Updating Google Maps MCP server..." -ForegroundColor Yellow
Write-Host "Server ID: $serverId" -ForegroundColor Cyan
Write-Host "Backend URL: $backendUrl" -ForegroundColor Cyan
Write-Host ""

$url = "$backendUrl/v0.1/publish"

try {
    $jsonBody = $updateData | ConvertTo-Json -Depth 10
    $response = Invoke-RestMethod -Uri $url -Method POST -Body $jsonBody -ContentType "application/json" -Headers @{"X-User-Id"="system"}
    
    Write-Host "✅ Successfully updated Google Maps MCP server!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Server details:" -ForegroundColor Yellow
    Write-Host "  Name: $($response.server.name)" -ForegroundColor White
    Write-Host "  Tools: $($response.server.tools.Count)" -ForegroundColor White
    if ($response.server.tools.Count -gt 0) {
        Write-Host "  Tool names: $($response.server.tools.name -join ', ')" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Failed to update server" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}
