# Deploy Backend to Cloud Run using Cloud Build (no local Docker needed)

param(
    [string]$ProjectId = "",
    [string]$Region = "us-central1",
    [string]$ServiceName = "mcp-registry-backend"
)

Write-Host "=== Deploy Backend to Cloud Run ===" -ForegroundColor Cyan
Write-Host ""

# Get project ID if not provided
if ([string]::IsNullOrEmpty($ProjectId)) {
    $ProjectId = gcloud config get-value project
    if ([string]::IsNullOrEmpty($ProjectId)) {
        Write-Host "❌ No project ID found. Set it with: gcloud config set project YOUR_PROJECT_ID" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Project ID: $ProjectId" -ForegroundColor Green
Write-Host "Region: $Region" -ForegroundColor Green
Write-Host "Service: $ServiceName" -ForegroundColor Green
Write-Host ""

# Check if we're in the backend directory
if (-not (Test-Path "Dockerfile")) {
    Write-Host "⚠️  Dockerfile not found. Switching to backend directory..." -ForegroundColor Yellow
    if (Test-Path "backend/Dockerfile") {
        Set-Location backend
    } else {
        Write-Host "❌ Dockerfile not found. Run this script from the project root or backend directory." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Step 1: Building and deploying with Cloud Build..." -ForegroundColor Yellow
Write-Host ""

# Build and deploy in one command using Cloud Build
gcloud run deploy $ServiceName `
    --source . `
    --region $Region `
    --platform managed `
    --set-secrets DATABASE_URL=db-url:latest `
    --add-cloudsql-instances slashmcp:$Region:mcp-registry-db `
    --allow-unauthenticated

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host ""
    
    # Get service URL
    $SERVICE_URL = gcloud run services describe $ServiceName --region $Region --format="value(status.url)"
    Write-Host "Service URL: $SERVICE_URL" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "Testing service..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    
    try {
        $health = Invoke-RestMethod -Uri "$SERVICE_URL/health" -ErrorAction Stop
        Write-Host "✅ Health check passed" -ForegroundColor Green
        
        $servers = Invoke-RestMethod -Uri "$SERVICE_URL/v0.1/servers" -ErrorAction Stop
        Write-Host "✅ Servers endpoint working - Found $($servers.Count) server(s)" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Service deployed but may need a moment to start" -ForegroundColor Yellow
        Write-Host "   Error: $_" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Set REGISTER_OFFICIAL_SERVERS_ON_STARTUP=true to auto-register MCP servers" -ForegroundColor White
    Write-Host "   2. Check logs: gcloud run services logs read $ServiceName --region $Region" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed. Check the errors above." -ForegroundColor Red
    exit 1
}
