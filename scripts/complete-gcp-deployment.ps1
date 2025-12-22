# Complete GCP Deployment Setup
# This script helps finish the deployment setup

param(
    [string]$VercelUrl = "",
    [string]$GeminiKey = "",
    [string]$VisionKey = ""
)

$PROJECT_ID = "slashmcp"
$REGION = "us-central1"
$SERVICE_NAME = "mcp-registry-backend"
$SERVICE_URL = "https://mcp-registry-backend-554655392699.us-central1.run.app"

Write-Host "🚀 Completing GCP Deployment Setup" -ForegroundColor Cyan
Write-Host ""

# Step 1: Set up secrets
Write-Host "📝 Step 1: Setting up secrets..." -ForegroundColor Yellow

# Check/create Google Gemini API key
if ($GeminiKey) {
    $existing = gcloud secrets describe google-gemini-api-key 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Updating google-gemini-api-key..." -ForegroundColor Gray
        echo -n $GeminiKey | gcloud secrets versions add google-gemini-api-key --data-file=-
    } else {
        Write-Host "   Creating google-gemini-api-key..." -ForegroundColor Gray
        echo -n $GeminiKey | gcloud secrets create google-gemini-api-key --data-file=-
    }
} else {
    Write-Host "   ⚠️  google-gemini-api-key not provided (skipping)" -ForegroundColor Yellow
}

# Check/create Google Vision API key
if ($VisionKey) {
    $existing = gcloud secrets describe google-vision-api-key 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Updating google-vision-api-key..." -ForegroundColor Gray
        echo -n $VisionKey | gcloud secrets versions add google-vision-api-key --data-file=-
    } else {
        Write-Host "   Creating google-vision-api-key..." -ForegroundColor Gray
        echo -n $VisionKey | gcloud secrets create google-vision-api-key --data-file=-
    }
} else {
    Write-Host "   ⚠️  google-vision-api-key not provided (skipping)" -ForegroundColor Yellow
}

# Generate encryption secrets if they don't exist
$encSecret = gcloud secrets describe encryption-secret 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "   Creating encryption-secret..." -ForegroundColor Gray
    $secret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    echo -n $secret | gcloud secrets create encryption-secret --data-file=-
}

$encSalt = gcloud secrets describe encryption-salt 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "   Creating encryption-salt..." -ForegroundColor Gray
    $salt = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 16 | ForEach-Object {[char]$_})
    echo -n $salt | gcloud secrets create encryption-salt --data-file=-
}

Write-Host ""

# Step 2: Update Cloud Run service
Write-Host "📝 Step 2: Updating Cloud Run service..." -ForegroundColor Yellow

# Set CORS origin
$corsOrigin = if ($VercelUrl) { $VercelUrl } else { "*" }
Write-Host "   Setting CORS_ORIGIN to: $corsOrigin" -ForegroundColor Gray

# Build secrets list
$secretsList = "OPENAI_API_KEY=openai-api-key:latest"
if ($GeminiKey) {
    $secretsList += ",GOOGLE_GEMINI_API_KEY=google-gemini-api-key:latest"
}
if ($VisionKey) {
    $secretsList += ",GOOGLE_VISION_API_KEY=google-vision-api-key:latest"
}
$secretsList += ",ENCRYPTION_SECRET=encryption-secret:latest,ENCRYPTION_SALT=encryption-salt:latest"

# Update service
gcloud run services update $SERVICE_NAME `
    --region $REGION `
    --set-secrets $secretsList `
    --update-env-vars "CORS_ORIGIN=$corsOrigin"

Write-Host ""

# Step 3: Summary
Write-Host "✅ Deployment setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Service URL: $SERVICE_URL" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Run database migrations (see scripts/run-migrations.ps1)" -ForegroundColor Gray
Write-Host "   2. Update Vercel environment variable:" -ForegroundColor Gray
Write-Host "      NEXT_PUBLIC_API_URL=$SERVICE_URL" -ForegroundColor White
Write-Host "   3. Test the API:" -ForegroundColor Gray
Write-Host "      curl $SERVICE_URL/health" -ForegroundColor White
Write-Host "      curl $SERVICE_URL/v0.1/servers" -ForegroundColor White
Write-Host ""
