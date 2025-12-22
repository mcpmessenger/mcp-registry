# PowerShell script to register MCP servers on Cloud Run
# This can be run manually or as a Cloud Run Job

param(
    [string]$ServiceUrl = "",
    [string]$Region = "us-central1",
    [string]$ServiceName = "mcp-registry-backend"
)

Write-Host "=== Register MCP Servers on Cloud Run ===" -ForegroundColor Cyan
Write-Host ""

# If service URL not provided, get it from gcloud
if ([string]::IsNullOrEmpty($ServiceUrl)) {
    Write-Host "Getting Cloud Run service URL..." -ForegroundColor Yellow
    $ServiceUrl = gcloud run services describe $ServiceName --region $Region --format="value(status.url)"
    
    if ([string]::IsNullOrEmpty($ServiceUrl)) {
        Write-Host "❌ Failed to get service URL. Make sure the service is deployed." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Service URL: $ServiceUrl" -ForegroundColor Green
}

Write-Host ""
Write-Host "Option 1: Set environment variable for automatic registration" -ForegroundColor Yellow
Write-Host "  gcloud run services update $ServiceName --region $Region --set-env-vars REGISTER_OFFICIAL_SERVERS_ON_STARTUP=true" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Do you want to set automatic registration? (y/n)"

if ($choice -eq "y" -or $choice -eq "Y") {
    Write-Host "Setting environment variable..." -ForegroundColor Yellow
    gcloud run services update $ServiceName --region $Region --set-env-vars REGISTER_OFFICIAL_SERVERS_ON_STARTUP=true
    
    Write-Host ""
    Write-Host "✅ Environment variable set!" -ForegroundColor Green
    Write-Host "   Servers will be registered automatically on next deployment/restart." -ForegroundColor Gray
    Write-Host ""
    Write-Host "To trigger registration now, restart the service:" -ForegroundColor Yellow
    Write-Host "  gcloud run services update-traffic $ServiceName --region $Region --to-latest" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "Option 2: Register servers via API" -ForegroundColor Yellow
    Write-Host ""
    
    # Test if service is accessible
    try {
        $health = Invoke-RestMethod -Uri "$ServiceUrl/health" -ErrorAction Stop
        Write-Host "✅ Service is accessible" -ForegroundColor Green
    } catch {
        Write-Host "❌ Cannot access service at $ServiceUrl" -ForegroundColor Red
        Write-Host "   Error: $_" -ForegroundColor Gray
        exit 1
    }
    
    # Check current servers
    Write-Host "Checking existing servers..." -ForegroundColor Yellow
    try {
        $existingServers = Invoke-RestMethod -Uri "$ServiceUrl/v0.1/servers" -ErrorAction Stop
        Write-Host "   Found $($existingServers.Count) existing server(s)" -ForegroundColor Cyan
        
        $hasPlaywright = $existingServers | Where-Object { $_.serverId -eq "com.microsoft.playwright/mcp" }
        $hasLangChain = $existingServers | Where-Object { $_.serverId -eq "com.langchain/agent-mcp-server" }
        
        if ($hasPlaywright -and $hasLangChain) {
            Write-Host "✅ Both servers are already registered!" -ForegroundColor Green
            exit 0
        }
    } catch {
        Write-Host "⚠️  Could not check existing servers: $_" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "To register servers manually, use the API:" -ForegroundColor Yellow
    Write-Host "  See docs/DEPLOYMENT_MCP_SERVERS.md for API examples" -ForegroundColor White
    Write-Host ""
    Write-Host "Or use a Cloud Run Job:" -ForegroundColor Yellow
    Write-Host "  See Option 2 in docs/DEPLOYMENT_MCP_SERVERS.md" -ForegroundColor White
}

Write-Host ""
Write-Host "📖 Full documentation: docs/DEPLOYMENT_MCP_SERVERS.md" -ForegroundColor Cyan
