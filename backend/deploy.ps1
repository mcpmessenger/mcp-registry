# Deployment script for MCP Registry Backend
# Run this script from the backend directory

$PROJECT_ID = "554655392699"
$SERVICE_NAME = "mcp-registry-backend"
$REGION = "us-central1"
$IMAGE_NAME = "gcr.io/$PROJECT_ID/$SERVICE_NAME"

Write-Host "🚀 Deploying MCP Registry Backend to Cloud Run" -ForegroundColor Green
Write-Host "Project ID: $PROJECT_ID" -ForegroundColor Yellow
Write-Host "Service: $SERVICE_NAME" -ForegroundColor Yellow
Write-Host "Region: $REGION" -ForegroundColor Yellow
Write-Host ""

# Step 1: Build and push container image
Write-Host "📦 Building and pushing container image..." -ForegroundColor Yellow
gcloud builds submit --tag $IMAGE_NAME --region $REGION .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Image built and pushed successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Deploy to Cloud Run
Write-Host "☁️  Deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $SERVICE_NAME `
    --image $IMAGE_NAME `
    --platform managed `
    --region $REGION `
    --allow-unauthenticated

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}

# Get the service URL
$ServiceUrl = (gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')

Write-Host ""
Write-Host "✅ Deployment successful!" -ForegroundColor Green
Write-Host "📍 Service URL: $ServiceUrl" -ForegroundColor Green
Write-Host "🏥 Health check: $ServiceUrl/health" -ForegroundColor Green

