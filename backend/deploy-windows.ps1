#!/usr/bin/env pwsh
# PowerShell Deployment Script for MCP Registry Backend
# Run from the backend directory

$ErrorActionPreference = "Stop"

$PROJECT_ID = "554655392699"
$PROJECT_NAME = "slashmcp"
$SERVICE_NAME = "mcp-registry-backend"
$REGION = "us-central1"
$REPOSITORY = "mcp-registry"
$IMAGE_NAME = "$REGION-docker.pkg.dev/$PROJECT_NAME/$REPOSITORY/$SERVICE_NAME"

Write-Host "🚀 Deploying MCP Registry Backend to Cloud Run" -ForegroundColor Cyan
Write-Host "Project ID: $PROJECT_ID" -ForegroundColor Gray
Write-Host "Service: $SERVICE_NAME" -ForegroundColor Gray
Write-Host "Region: $REGION" -ForegroundColor Gray
Write-Host ""

# Check if gcloud is available as a direct executable
$gcloudCmd = Get-Command gcloud.cmd -ErrorAction SilentlyContinue

if (-not $gcloudCmd) {
    Write-Host "❌ gcloud CLI not found! Please install it or run as administrator." -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative option:" -ForegroundColor Yellow
    Write-Host "1. Open Google Cloud Console: https://console.cloud.google.com/run" -ForegroundColor Yellow
    Write-Host "2. Navigate to Cloud Run" -ForegroundColor Yellow
    Write-Host "3. Edit service: $SERVICE_NAME" -ForegroundColor Yellow
    Write-Host "4. Deploy from source (GitHub) or manually upload Docker image" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ gcloud CLI found at: $($gcloudCmd.Source)" -ForegroundColor Green
Write-Host ""

# Step 1: Build and push container image
Write-Host "📦 Building and pushing container image..." -ForegroundColor Cyan
& gcloud.cmd builds submit --tag $IMAGE_NAME --region $REGION .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Image built and pushed successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Read environment variables from .env
$envVars = @()
if (Test-Path ".env") {
    Write-Host "📝 Reading environment variables from .env..." -ForegroundColor Cyan
    
    Get-Content ".env" | ForEach-Object {
        $line = $_.Trim()
        
        # Skip empty lines and comments
        if ($line -eq "" -or $line.StartsWith("#")) {
            return
        }
        
        # Parse KEY=VALUE
        if ($line -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            
            # Skip local DATABASE_URL
            if ($key -eq "DATABASE_URL" -and $value.StartsWith("file:")) {
                Write-Host "   ⚠️  Skipping local DATABASE_URL (file:). Use Cloud SQL or hosted PostgreSQL." -ForegroundColor Yellow
                return
            }
            
            # Skip localhost references
            if ($value -match "localhost") {
                Write-Host "   ⚠️  Skipping $key with localhost reference" -ForegroundColor Yellow
                return
            }
            
            $envVars += "$key=$value"
            Write-Host "   ✓ Added env var: $key" -ForegroundColor Gray
        }
    }
    Write-Host ""
}

# Step 3: Deploy to Cloud Run
Write-Host "☁️  Deploying to Cloud Run..." -ForegroundColor Cyan

$deployArgs = @(
    "run", "deploy", $SERVICE_NAME,
    "--image", $IMAGE_NAME,
    "--platform", "managed",
    "--region", $REGION,
    "--allow-unauthenticated",
    "--memory", "2Gi",
    "--cpu", "2",
    "--timeout", "300",
    "--max-instances", "10",
    "--min-instances", "0"
)

# Add environment variables
if ($envVars.Count -gt 0) {
    # Create temp file for env vars
    $tempFile = New-TemporaryFile
    $envVars | Out-File -FilePath $tempFile.FullName -Encoding utf8
    $deployArgs += "--env-vars-file"
    $deployArgs += $tempFile.FullName
}

# Always set production env
$deployArgs += "--update-env-vars"
$deployArgs += "NODE_ENV=production,ENABLE_PULSAR=false,ENABLE_KAFKA=false"

& gcloud.cmd $deployArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    if ($tempFile) { Remove-Item $tempFile }
    exit 1
}

# Clean up
if ($tempFile) { Remove-Item $tempFile }

# Get the service URL
$serviceUrl = & gcloud.cmd run services describe $SERVICE_NAME --region $REGION --format "value(status.url)"

Write-Host ""
Write-Host "✅ Deployment successful!" -ForegroundColor Green
Write-Host "📍 Service URL: $serviceUrl" -ForegroundColor Cyan
Write-Host "🏥 Health check: $serviceUrl/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Update Vercel environment variable: NEXT_PUBLIC_API_URL=$serviceUrl" -ForegroundColor Gray
Write-Host "   2. Test the health endpoint: curl $serviceUrl/health" -ForegroundColor Gray
Write-Host "   3. Run database migrations (see DEPLOYMENT_GUIDE.md)" -ForegroundColor Gray
Write-Host ""
