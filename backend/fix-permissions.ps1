# Fix Artifact Registry Permissions for Cloud Build
# Run this script in an ADMIN PowerShell terminal

$PROJECT_ID = "554655392699"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Granting Cloud Build Artifact Registry Permissions" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Get project number
Write-Host "Step 1: Getting project number..." -ForegroundColor Yellow
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($PROJECT_NUMBER)) {
    Write-Host "Failed to get project number!" -ForegroundColor Red
    Write-Host "Make sure you're authenticated: gcloud auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "Project Number: $PROJECT_NUMBER" -ForegroundColor Green
Write-Host ""

# Construct service account email
$SERVICE_ACCOUNT = "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
Write-Host "Step 2: Granting Artifact Registry Writer role..." -ForegroundColor Yellow
Write-Host "Service Account: $SERVICE_ACCOUNT" -ForegroundColor Cyan
Write-Host ""

# Grant permission
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/artifactregistry.writer"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Failed to grant permissions!" -ForegroundColor Red
    Write-Host "Make sure you have the Project IAM Admin role" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "Permissions granted successfully!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Service Account: $SERVICE_ACCOUNT" -ForegroundColor Cyan
Write-Host "Role: roles/artifactregistry.writer" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now deploy with: .\deploy.ps1" -ForegroundColor Yellow
Write-Host ""
