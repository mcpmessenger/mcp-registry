# Fix Playwright HTTP Server Environment Variable
# This updates the separate Playwright MCP HTTP Server Cloud Run service

$PROJECT_ID = "slashmcp"
$REGION = "us-central1"
$PLAYWRIGHT_SERVICE_NAME = "playwright-mcp-http-server"

Write-Host "=== Fixing Playwright HTTP Server ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will update the Playwright MCP HTTP Server with the sandbox fix" -ForegroundColor Yellow
Write-Host "Service: $PLAYWRIGHT_SERVICE_NAME" -ForegroundColor Gray
Write-Host "Region: $REGION" -ForegroundColor Gray
Write-Host ""

# Check if gcloud is installed
try {
    $gcloudVersion = gcloud --version 2>&1 | Select-Object -First 1
    Write-Host "Using: $gcloudVersion" -ForegroundColor Gray
} catch {
    Write-Host "ERROR: gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Red
    exit 1
}

# Set project
try {
    $currentProject = gcloud config get-value project 2>&1
    if ($currentProject -ne $PROJECT_ID) {
        Write-Host "Setting project to $PROJECT_ID..." -ForegroundColor Yellow
        gcloud config set project $PROJECT_ID
    }
} catch {
    Write-Host "ERROR: Not authenticated. Run: gcloud auth login" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Updating Playwright HTTP Server with PLAYWRIGHT_MCP_SANDBOX=false..." -ForegroundColor Yellow
Write-Host ""

try {
    # Update the service with the environment variable
    gcloud run services update $PLAYWRIGHT_SERVICE_NAME `
        --region $REGION `
        --set-env-vars "PLAYWRIGHT_MCP_SANDBOX=false"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "SUCCESS: Playwright HTTP Server updated!" -ForegroundColor Green
        Write-Host ""
        
        # Get service URL
        $SERVICE_URL = gcloud run services describe $PLAYWRIGHT_SERVICE_NAME --region $REGION --format="value(status.url)"
        Write-Host "Service URL: $SERVICE_URL" -ForegroundColor Cyan
        Write-Host ""
        
        Write-Host "Waiting for service to restart..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
        
        # Test health endpoint
        try {
            $health = Invoke-RestMethod -Uri "$SERVICE_URL/health" -TimeoutSec 10 -ErrorAction Stop
            Write-Host "SUCCESS: Health check passed" -ForegroundColor Green
            Write-Host "Service is ready!" -ForegroundColor Green
        } catch {
            Write-Host "WARNING: Service may need a moment to restart" -ForegroundColor Yellow
            Write-Host "   Error: $_" -ForegroundColor Gray
        }
        
        Write-Host ""
        Write-Host "=== Summary ===" -ForegroundColor Cyan
        Write-Host "Playwright HTTP Server URL: $SERVICE_URL" -ForegroundColor White
        Write-Host "Environment variable set: PLAYWRIGHT_MCP_SANDBOX=false" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Test Playwright navigation in your chat interface" -ForegroundColor White
        Write-Host "2. The sandbox error should now be fixed!" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "ERROR: Update failed. Check errors above." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "ERROR: Update failed: $_" -ForegroundColor Red
    exit 1
}





