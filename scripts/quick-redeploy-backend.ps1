# Quick Redeploy Backend to Cloud Run
# This redeploys the backend with the latest code changes

$PROJECT_ID = "slashmcp"
$REGION = "us-central1"
$SERVICE_NAME = "mcp-registry-backend"

Write-Host "=== Quick Redeploy Backend ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will deploy the latest code from GitHub to Cloud Run" -ForegroundColor Yellow
Write-Host "Project: $PROJECT_ID" -ForegroundColor Gray
Write-Host "Region: $REGION" -ForegroundColor Gray
Write-Host "Service: $SERVICE_NAME" -ForegroundColor Gray
Write-Host ""

# Check if gcloud is installed
try {
    $gcloudVersion = gcloud --version 2>&1 | Select-Object -First 1
    Write-Host "Using: $gcloudVersion" -ForegroundColor Gray
} catch {
    Write-Host "ERROR: gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Red
    exit 1
}

# Check if we're authenticated
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
Write-Host "Step 1: Building and deploying from source..." -ForegroundColor Yellow
Write-Host "This may take 3-5 minutes..." -ForegroundColor Gray
Write-Host ""

# Navigate to backend directory
$originalLocation = Get-Location
if (Test-Path "backend/Dockerfile") {
    Set-Location backend
} elseif (-not (Test-Path "Dockerfile")) {
    Write-Host "ERROR: Dockerfile not found. Run this from project root." -ForegroundColor Red
    exit 1
}

# Deploy using Cloud Build (builds from source)
try {
    Write-Host "Deploying..." -ForegroundColor Yellow
    Write-Host "Note: Google Vision API key is optional - removed from deployment" -ForegroundColor Gray
    Write-Host ""
    
    gcloud run deploy $SERVICE_NAME `
        --source . `
        --region $REGION `
        --platform managed `
        --allow-unauthenticated `
        --memory 2Gi `
        --timeout 300 `
        --max-instances 10 `
        --set-secrets DATABASE_URL=db-url:latest `
        --set-secrets GOOGLE_GEMINI_API_KEY=google-gemini-api-key:latest `
        --add-cloudsql-instances "$PROJECT_ID`:$REGION`:mcp-registry-db" `
        --set-env-vars "NODE_ENV=production,CORS_ORIGIN=https://mcp-registry-sentilabs.vercel.app,REGISTER_OFFICIAL_SERVERS_ON_STARTUP=true"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "SUCCESS: Deployment complete!" -ForegroundColor Green
        Write-Host ""
        
        # Get service URL
        $SERVICE_URL = gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)"
        Write-Host "Service URL: $SERVICE_URL" -ForegroundColor Cyan
        Write-Host ""
        
        Write-Host "Waiting for service to be ready..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        
        # Test health endpoint
        try {
            $health = Invoke-RestMethod -Uri "$SERVICE_URL/health" -TimeoutSec 10 -ErrorAction Stop
            Write-Host "SUCCESS: Health check passed" -ForegroundColor Green
            
            # Test servers endpoint
            $servers = Invoke-RestMethod -Uri "$SERVICE_URL/v0.1/servers" -TimeoutSec 10 -ErrorAction Stop
            Write-Host "SUCCESS: Servers endpoint working - Found $($servers.Count) server(s)" -ForegroundColor Green
        } catch {
            Write-Host "WARNING: Service deployed but may need a moment to start" -ForegroundColor Yellow
            Write-Host "   Error: $_" -ForegroundColor Gray
        }
        
        Write-Host ""
        Write-Host "=== Deployment Summary ===" -ForegroundColor Cyan
        Write-Host "Backend URL: $SERVICE_URL" -ForegroundColor White
        Write-Host "Timeout fix: Applied (180s for Playwright operations)" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Test Playwright in the chat interface" -ForegroundColor White
        Write-Host "2. Check logs if issues: gcloud run services logs read $SERVICE_NAME --region $REGION --limit 50" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "ERROR: Deployment failed. Check errors above." -ForegroundColor Red
        Set-Location $originalLocation
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "ERROR: Deployment failed: $_" -ForegroundColor Red
    Set-Location $originalLocation
    exit 1
} finally {
    Set-Location $originalLocation
}
