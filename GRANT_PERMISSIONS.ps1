# Grant Cloud Build permissions for Artifact Registry
# Run this script in an ADMIN PowerShell terminal

$PROJECT_ID = "554655392699"

Write-Host "Granting Cloud Build permissions for Artifact Registry..." -ForegroundColor Yellow
Write-Host ""

# Get project number
Write-Host "Getting project number..." -ForegroundColor Cyan
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to get project number!" -ForegroundColor Red
    exit 1
}

Write-Host "Project Number: $PROJECT_NUMBER" -ForegroundColor Green
Write-Host ""

# Grant Artifact Registry Writer role
Write-Host "Granting Artifact Registry Writer role..." -ForegroundColor Cyan
$SERVICE_ACCOUNT = "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SERVICE_ACCOUNT" `
    --role="roles/artifactregistry.writer"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to grant permissions!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Permissions granted successfully!" -ForegroundColor Green
Write-Host "Service Account: $SERVICE_ACCOUNT" -ForegroundColor Green
Write-Host "Role: roles/artifactregistry.writer" -ForegroundColor Green
Write-Host ""
Write-Host "You can now deploy again with: .\deploy.ps1" -ForegroundColor Yellow

