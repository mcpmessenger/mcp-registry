# Deployment script for MCP Registry Backend
# Run this script from the backend directory
#
# Usage:
#   .\deploy.ps1
#   .\deploy.ps1 -SetEnvVars  # Update environment variables only
#   .\deploy.ps1 -SkipBuild   # Deploy existing image only

param(
    [switch]$SetEnvVars,
    [switch]$SkipBuild
)

$PROJECT_ID = "554655392699"
$SERVICE_NAME = "mcp-registry-backend"
$REGION = "us-central1"
$IMAGE_NAME = "gcr.io/$PROJECT_ID/$SERVICE_NAME"

Write-Host "Deploying MCP Registry Backend to Cloud Run" -ForegroundColor Green
Write-Host "Project ID: $PROJECT_ID" -ForegroundColor Yellow
Write-Host "Service: $SERVICE_NAME" -ForegroundColor Yellow
Write-Host "Region: $REGION" -ForegroundColor Yellow
Write-Host ""

# Check if .env file exists for environment variables
$envFile = ".env"
$hasEnvFile = Test-Path $envFile

if ($SetEnvVars -and !$hasEnvFile) {
    Write-Host "Warning: .env file not found. Environment variables will not be updated." -ForegroundColor Yellow
    Write-Host "   Create a .env file or use Secret Manager for sensitive values." -ForegroundColor Yellow
    Write-Host ""
}

# Step 1: Build and push container image (skip if flag is set)
if (!$SkipBuild -and !$SetEnvVars) {
    Write-Host "Building and pushing container image..." -ForegroundColor Yellow
    gcloud builds submit --tag $IMAGE_NAME --region $REGION .

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed!" -ForegroundColor Red
        exit 1
    }

    Write-Host "Image built and pushed successfully" -ForegroundColor Green
    Write-Host ""
}

# Step 2: Prepare environment variables
$envVars = @()
$secrets = @()

if ($hasEnvFile -and !$SkipBuild) {
    Write-Host "Reading environment variables from .env..." -ForegroundColor Yellow
    
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        
        # Skip empty lines and comments
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
            return
        }
        
        # Parse KEY=VALUE
        if ($line -match "^([^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            
            # Skip DATABASE_URL if it's a file path (use Cloud SQL instead)
            if ($key -eq "DATABASE_URL" -and $value.StartsWith("file:")) {
                Write-Host "   Skipping local DATABASE_URL (file:). Use Cloud SQL connection string." -ForegroundColor Yellow
                return
            }
            
            # Check if it's a secret reference (format: secret-name:latest)
            if ($value -match "^[a-zA-Z0-9_-]+:latest$") {
                $secrets += "${key}=${value}"
                Write-Host "   Added secret: ${key}=${value}" -ForegroundColor Green
            } elseif ($key -eq "CORS_ORIGIN" -and [string]::IsNullOrWhiteSpace($value)) {
                # Skip empty CORS_ORIGIN (will be set to allow all)
            } else {
                $envVars += "${key}=${value}"
                Write-Host "   Added env var: ${key}" -ForegroundColor Green
            }
        }
    }
    
    Write-Host ""
}

# Step 3: Build deployment command
$deployCmd = "gcloud run deploy $SERVICE_NAME " +
    "--image $IMAGE_NAME " +
    "--platform managed " +
    "--region $REGION " +
    "--allow-unauthenticated " +
    "--memory 2Gi " +
    "--cpu 2 " +
    "--timeout 300 " +
    "--max-instances 10 " +
    "--min-instances 0"

# Add environment variables if any
if ($envVars.Count -gt 0) {
    $envVarString = $envVars -join ","
    $deployCmd += ' --set-env-vars "' + $envVarString + '"'
}

# Add secrets if any
if ($secrets.Count -gt 0) {
    $secretString = $secrets -join ","
    $deployCmd += ' --set-secrets "' + $secretString + '"'
}

# If only setting env vars, update them separately
if ($SetEnvVars) {
    Write-Host "Updating environment variables only..." -ForegroundColor Yellow
    
    if ($envVars.Count -gt 0) {
        $envVarString = $envVars -join ","
        $updateCmd = "gcloud run services update $SERVICE_NAME --region $REGION --update-env-vars `"$envVarString`""
        Invoke-Expression $updateCmd
    }
    
    if ($secrets.Count -gt 0) {
        $secretString = $secrets -join ","
        $updateSecretCmd = "gcloud run services update $SERVICE_NAME --region $REGION --update-secrets `"$secretString`""
        Invoke-Expression $updateSecretCmd
    }
    
    Write-Host "Environment variables updated!" -ForegroundColor Green
    Write-Host ""
} else {
    # Step 4: Deploy to Cloud Run
    Write-Host "Deploying to Cloud Run..." -ForegroundColor Yellow
    Invoke-Expression $deployCmd

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Deployment failed!" -ForegroundColor Red
        exit 1
    }
}

# Get the service URL
$ServiceUrl = (gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')

Write-Host ""
Write-Host "Deployment successful!" -ForegroundColor Green
Write-Host "Service URL: $ServiceUrl" -ForegroundColor Green
Write-Host "Health check: $ServiceUrl/health" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
$nextStep1 = "   1. Update Vercel environment variable: NEXT_PUBLIC_API_URL=$ServiceUrl"
Write-Host $nextStep1 -ForegroundColor White
Write-Host "   2. Update backend CORS_ORIGIN to allow your Vercel domain" -ForegroundColor White
Write-Host ""

