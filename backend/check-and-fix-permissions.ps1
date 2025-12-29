# Check and Fix Artifact Registry Permissions
# Run this script in an ADMIN PowerShell terminal

$PROJECT_ID = "554655392699"
$REGION = "us-central1"
$REPOSITORY = "mcp-registry"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Checking Artifact Registry Setup" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get project number
Write-Host "Step 1: Getting project number..." -ForegroundColor Yellow
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)" 2>&1

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($PROJECT_NUMBER)) {
    Write-Host "Failed to get project number!" -ForegroundColor Red
    Write-Host "Make sure you're authenticated: gcloud auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "Project Number: $PROJECT_NUMBER" -ForegroundColor Green
Write-Host ""

# Step 2: Check if repository exists
Write-Host "Step 2: Checking if repository exists..." -ForegroundColor Yellow
$repoCheck = gcloud artifacts repositories describe $REPOSITORY --location=$REGION 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Repository does not exist. Creating it..." -ForegroundColor Yellow
    gcloud artifacts repositories create $REPOSITORY --repository-format=docker --location=$REGION --description="Docker repository for MCP Registry Backend"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to create repository!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Repository created successfully!" -ForegroundColor Green
} else {
    Write-Host "Repository exists." -ForegroundColor Green
}
Write-Host ""

# Step 3: Grant permissions
$SERVICE_ACCOUNT = "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
Write-Host "Step 3: Granting Artifact Registry Writer role..." -ForegroundColor Yellow
Write-Host "Service Account: $SERVICE_ACCOUNT" -ForegroundColor Cyan
Write-Host ""

gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/artifactregistry.writer"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Failed to grant permissions!" -ForegroundColor Red
    Write-Host "Make sure you have the Project IAM Admin role" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Repository: $REPOSITORY" -ForegroundColor Cyan
Write-Host "Location: $REGION" -ForegroundColor Cyan
Write-Host "Service Account: $SERVICE_ACCOUNT" -ForegroundColor Cyan
Write-Host "Role: roles/artifactregistry.writer" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now deploy with: .\deploy.ps1" -ForegroundColor Yellow
Write-Host ""

