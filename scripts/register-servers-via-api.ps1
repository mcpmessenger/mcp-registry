# Register MCP Servers via API (if auto-registration didn't work)

param(
    [string]$ServiceUrl = "https://mcp-registry-backend-554655392699.us-central1.run.app"
)

Write-Host "=== Register MCP Servers via API ===" -ForegroundColor Cyan
Write-Host ""

# Test service is accessible
try {
    $health = Invoke-RestMethod -Uri "$ServiceUrl/health" -ErrorAction Stop
    Write-Host "✅ Service is accessible" -ForegroundColor Green
} catch {
    Write-Host "❌ Cannot access service: $_" -ForegroundColor Red
    exit 1
}

# Register Playwright
Write-Host ""
Write-Host "Registering Playwright MCP Server..." -ForegroundColor Yellow

$playwrightBody = @{
    serverId = "com.microsoft.playwright/mcp"
    name = "Playwright MCP Server"
    description = "Official Microsoft Playwright MCP server for browser automation. Enables LLMs to interact with web pages through structured accessibility snapshots, navigate, click, fill forms, take screenshots, and more."
    version = "v0.1"
    command = "npx"
    args = @("-y", "@playwright/mcp@latest")
    tools = @(
        @{
            name = "browser_navigate"
            description = "Navigate to a URL"
            inputSchema = @{
                type = "object"
                properties = @{
                    url = @{
                        type = "string"
                        description = "The URL to navigate to"
                    }
                }
                required = @("url")
            }
        },
        @{
            name = "browser_take_screenshot"
            description = "Take a screenshot of the current page or element"
            inputSchema = @{
                type = "object"
                properties = @{
                    type = @{
                        type = "string"
                        description = "Image format (png, jpeg)"
                    }
                    fullPage = @{
                        type = "boolean"
                        description = "Take screenshot of full scrollable page"
                    }
                }
            }
        }
    )
    capabilities = @("tools")
    metadata = @{
        source = "official"
        publisher = "Microsoft"
        npmPackage = "@playwright/mcp"
        verified = $true
    }
} | ConvertTo-Json -Depth 10

try {
    $result = Invoke-RestMethod -Uri "$ServiceUrl/v0.1/publish" -Method POST -ContentType "application/json" -Body $playwrightBody
    Write-Host "✅ Playwright registered!" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "⚠️  Playwright already exists (this is OK)" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Failed to register Playwright: $_" -ForegroundColor Red
    }
}

# Register LangChain
Write-Host ""
Write-Host "Registering LangChain Agent MCP Server..." -ForegroundColor Yellow

$langchainBody = @{
    serverId = "com.langchain/agent-mcp-server"
    name = "LangChain Agent MCP Server"
    description = "LangChain Agent MCP Server hosted on Google Cloud Run (langchain-agent-mcp-server-554655392699.us-central1.run.app)."
    version = "1.0.0"
    tools = @(
        @{
            name = "agent_executor"
            description = "Execute a complex, multi-step reasoning task"
            inputSchema = @{
                type = "object"
                properties = @{
                    query = @{
                        type = "string"
                        description = "The user's query or task"
                    }
                }
                required = @("query")
            }
        }
    )
    capabilities = @("tools")
    metadata = @{
        source = "official"
        publisher = "LangChainMCP"
        endpoint = "https://langchain-agent-mcp-server-554655392699.us-central1.run.app"
        verified = $true
    }
} | ConvertTo-Json -Depth 10

try {
    $result = Invoke-RestMethod -Uri "$ServiceUrl/v0.1/publish" -Method POST -ContentType "application/json" -Body $langchainBody
    Write-Host "✅ LangChain registered!" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "⚠️  LangChain already exists (this is OK)" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Failed to register LangChain: $_" -ForegroundColor Red
    }
}

# Verify
Write-Host ""
Write-Host "Verifying registration..." -ForegroundColor Cyan
$servers = Invoke-RestMethod -Uri "$ServiceUrl/v0.1/servers"
Write-Host "✅ Found $($servers.Count) server(s) total" -ForegroundColor Green
$servers | ForEach-Object {
    Write-Host "   - $($_.name) ($($_.serverId))" -ForegroundColor Gray
}
