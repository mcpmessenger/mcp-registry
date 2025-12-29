# Deploy using local Docker build (bypasses Cloud Build permissions)
# Requires Docker Desktop to be installed and running

$PROJECT_ID = "554655392699"
$SERVICE_NAME = "mcp-registry-backend"
$REGION = "us-central1"
$REPOSITORY = "mcp-registry"
$IMAGE_NAME = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$SERVICE_NAME"

Write-Host "Deploying using local Docker build..." -ForegroundColor Green
Write-Host "Project ID: $PROJECT_ID" -ForegroundColor Yellow
Write-Host "Service: $SERVICE_NAME" -ForegroundColor Yellow
Write-Host "Region: $REGION" -ForegroundColor Yellow
Write-Host ""

# Check if Docker is available
$dockerCheck = docker --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker is not installed or not running!" -ForegroundColor Red
    Write-Host "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

Write-Host "Docker is available: $dockerCheck" -ForegroundColor Green
Write-Host ""

# Configure Docker to use gcloud as credential helper
Write-Host "Configuring Docker authentication..." -ForegroundColor Yellow
gcloud auth configure-docker ${REGION}-docker.pkg.dev

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to configure Docker authentication!" -ForegroundColor Red
    Write-Host "Make sure you're authenticated: gcloud auth login" -ForegroundColor Yellow
    exit 1
}

# Also ensure we're authenticated
Write-Host "Ensuring gcloud authentication..." -ForegroundColor Yellow
gcloud auth application-default login --quiet 2>&1 | Out-Null

Write-Host "Docker authentication configured" -ForegroundColor Green
Write-Host ""

# Build the Docker image locally
Write-Host "Building Docker image locally..." -ForegroundColor Yellow
docker build -t $IMAGE_NAME .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Image built successfully" -ForegroundColor Green
Write-Host ""

# Push the image to Artifact Registry
Write-Host "Pushing image to Artifact Registry..." -ForegroundColor Yellow
docker push $IMAGE_NAME

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to push image!" -ForegroundColor Red
    exit 1
}

Write-Host "Image pushed successfully" -ForegroundColor Green
Write-Host ""

# Now deploy to Cloud Run using the deploy script's env var logic
Write-Host "Deploying to Cloud Run..." -ForegroundColor Yellow

# Read environment variables from .env if it exists
$envVars = @()
if (Test-Path ".env") {
    Write-Host "Reading environment variables from .env..." -ForegroundColor Yellow
    Get-Content ".env" | ForEach-Object {
        $line = $_.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
            return
        }
        if ($line -match "^([^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            if ($key -eq "DATABASE_URL" -and $value.StartsWith("file:")) {
                return
            }
            if (![string]::IsNullOrWhiteSpace($value)) {
                $envVars += "${key}=${value}"
            }
        }
    }
}

# Build deploy command
$deployCmd = "gcloud run deploy $SERVICE_NAME --image $IMAGE_NAME --platform managed --region $REGION --allow-unauthenticated --memory 2Gi --cpu 2 --timeout 300 --max-instances 10 --min-instances 0"

if ($envVars.Count -gt 0) {
    $envVarString = $envVars -join ","
    $deployCmd += " --set-env-vars `"$envVarString`""
}

Invoke-Expression $deployCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "Deployment failed!" -ForegroundColor Red
    exit 1
}

# Get the service URL
$ServiceUrl = (gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')

Write-Host ""
Write-Host "Deployment successful!" -ForegroundColor Green
Write-Host "Service URL: $ServiceUrl" -ForegroundColor Green
Write-Host "Health check: $ServiceUrl/health" -ForegroundColor Green
Write-Host ""

