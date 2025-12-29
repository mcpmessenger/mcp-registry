# Authenticate Docker with Artifact Registry
# Run this script to fix Docker authentication

$REGION = "us-central1"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Configuring Docker Authentication" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if user is authenticated
Write-Host "Step 1: Checking gcloud authentication..." -ForegroundColor Yellow
$authCheck = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1

if ([string]::IsNullOrWhiteSpace($authCheck) -or $LASTEXITCODE -ne 0) {
    Write-Host "Not authenticated. Logging in..." -ForegroundColor Yellow
    gcloud auth login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Authentication failed!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Authenticated as: $authCheck" -ForegroundColor Green
}
Write-Host ""

# Configure Docker to use gcloud credentials
Write-Host "Step 2: Configuring Docker for Artifact Registry..." -ForegroundColor Yellow
$registry = "${REGION}-docker.pkg.dev"
Write-Host "Registry: $registry" -ForegroundColor Cyan

gcloud auth configure-docker $registry

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Failed to configure Docker!" -ForegroundColor Red
    Write-Host "Make sure Docker Desktop is running" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "Docker authentication configured!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "You can now deploy with: .\deploy-local-docker.ps1" -ForegroundColor Yellow
Write-Host ""

