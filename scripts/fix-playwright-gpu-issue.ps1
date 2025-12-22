# Fix Playwright GPU/Timeout Issues
# This script re-registers the Playwright MCP server with proper environment variables
# to disable GPU acceleration and use software rendering

$ErrorActionPreference = "Stop"

Write-Host "🔧 Fixing Playwright MCP Server Configuration" -ForegroundColor Cyan
Write-Host ""

# Check if backend is running
$backendUrl = "http://localhost:3001"
try {
    $health = Invoke-RestMethod -Uri "$backendUrl/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend is not running. Please start it first:" -ForegroundColor Red
    Write-Host "   cd backend" -ForegroundColor Yellow
    Write-Host "   npm start" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "🔄 Re-registering Playwright server with GPU-disabled configuration..." -ForegroundColor Yellow

# Update the Playwright server registration
$body = @{
    serverId = "com.microsoft.playwright/mcp"
    name = "Playwright MCP Server"
    description = "Official Microsoft Playwright MCP server for browser automation. Enables LLMs to interact with web pages through structured accessibility snapshots, navigate, click, fill forms, take screenshots, and more."
    version = "v0.1"
    command = "npx"
    args = @("-y", "@playwright/mcp@latest")
    env = @{
        DISPLAY = ":99"
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "0"
        PLAYWRIGHT_BROWSERS_PATH = "/ms-playwright-browsers"
        CHROME_FLAGS = "--disable-gpu --use-gl=swiftshader --no-sandbox --disable-dev-shm-usage"
        PLAYWRIGHT_BROWSER_LAUNCH_TIMEOUT = "120000"
    }
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
        }
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
                    filename = @{
                        type = "string"
                        description = "File name to save screenshot"
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
        repository = "https://github.com/microsoft/playwright-mcp"
        documentation = "https://github.com/microsoft/playwright-mcp"
        verified = $true
    }
} | ConvertTo-Json -Depth 10

try {
    $encodedServerId = [System.Web.HttpUtility]::UrlEncode("com.microsoft.playwright/mcp")
    $response = Invoke-RestMethod -Uri "$backendUrl/v0.1/servers/$encodedServerId" -Method PUT -Body $body -ContentType "application/json" -ErrorAction Stop
    
    Write-Host "✅ Successfully updated Playwright server configuration!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Updated environment variables:" -ForegroundColor Cyan
    Write-Host "   - DISPLAY: :99" -ForegroundColor Gray
    Write-Host "   - CHROME_FLAGS: --disable-gpu --use-gl=swiftshader --no-sandbox --disable-dev-shm-usage" -ForegroundColor Gray
    Write-Host "   - PLAYWRIGHT_BROWSER_LAUNCH_TIMEOUT: 120000" -ForegroundColor Gray
    Write-Host ""
    Write-Host "✨ Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Try using Playwright again through the MCP registry" -ForegroundColor White
    Write-Host "   2. If it still times out, the Playwright MCP server may need to be updated" -ForegroundColor White
    Write-Host "      to respect these environment variables" -ForegroundColor White
    
} catch {
    Write-Host "❌ Failed to update Playwright server:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
    exit 1
}
