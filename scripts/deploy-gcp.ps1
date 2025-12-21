# GCP Deployment Script for MCP Registry Backend
# Usage: .\scripts\deploy-gcp.ps1

param(
    [string]$ProjectId = "mcp-registry-prod",
    [string]$Region = "us-central1",
    [string]$ServiceName = "mcp-registry-backend",
    [string]$DbInstance = "mcp-registry-db",
    [string]$FrontendUrl = "https://your-app.vercel.app"
)

Write-Host "🚀 Deploying MCP Registry Backend to GCP" -ForegroundColor Cyan
Write-Host ""

# Set project
Write-Host "📋 Setting GCP project..." -ForegroundColor Yellow
gcloud config set project $ProjectId
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to set project. Make sure gcloud CLI is installed and you're logged in." -ForegroundColor Red
    exit 1
}

# Build and push container
Write-Host "🔨 Building container image..." -ForegroundColor Yellow
gcloud builds submit --tag gcr.io/$ProjectId/$ServiceName ./backend
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

# Get database connection name
Write-Host "🗄️  Getting database connection info..." -ForegroundColor Yellow
$dbConnection = gcloud sql instances describe $DbInstance --format="value(connectionName)" 2>$null
if (-not $dbConnection) {
    Write-Host "⚠️  Database instance not found. Creating..." -ForegroundColor Yellow
    Write-Host "   Run this manually first:" -ForegroundColor Gray
    Write-Host "   gcloud sql instances create $DbInstance --database-version=POSTGRES_15 --tier=db-f1-micro --region=$Region" -ForegroundColor Gray
    exit 1
}

# Get database password from secret
Write-Host "🔐 Retrieving database password..." -ForegroundColor Yellow
$dbPassword = gcloud secrets versions access latest --secret=db-password 2>$null
if (-not $dbPassword) {
    Write-Host "⚠️  Database password secret not found. Creating..." -ForegroundColor Yellow
    $password = Read-Host "Enter database password" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
    $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    echo -n $plainPassword | gcloud secrets create db-password --data-file=-
    $dbPassword = $plainPassword
}

# Construct DATABASE_URL
$databaseUrl = "postgresql://postgres:$dbPassword@/$DbInstance/mcp_registry?host=/cloudsql/$dbConnection"

# Deploy to Cloud Run
Write-Host "🚀 Deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $ServiceName `
    --image gcr.io/$ProjectId/$ServiceName `
    --platform managed `
    --region $Region `
    --allow-unauthenticated `
    --add-cloudsql-instances $dbConnection `
    --set-env-vars "NODE_ENV=production,PORT=3001,CORS_ORIGIN=$FrontendUrl" `
    --set-secrets "GOOGLE_GEMINI_API_KEY=google-gemini-api-key:latest,GOOGLE_VISION_API_KEY=google-vision-api-key:latest,OPENAI_API_KEY=openai-api-key:latest,ENCRYPTION_SECRET=encryption-secret:latest,ENCRYPTION_SALT=encryption-salt:latest" `
    --set-env-vars "DATABASE_URL=$databaseUrl" `
    --memory 2Gi `
    --cpu 2 `
    --timeout 300 `
    --max-instances 10 `
    --min-instances 1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}

# Get service URL
$serviceUrl = gcloud run services describe $ServiceName `
    --platform managed `
    --region $Region `
    --format="value(status.url)"

Write-Host ""
Write-Host "✅ Deployment successful!" -ForegroundColor Green
Write-Host "📍 Service URL: $serviceUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Update Vercel environment variable: NEXT_PUBLIC_API_URL=$serviceUrl" -ForegroundColor Gray
Write-Host "   2. Run database migrations:" -ForegroundColor Gray
Write-Host "      gcloud run jobs create migrate-db --image gcr.io/$ProjectId/$ServiceName --region $Region --command npm --args 'run,migrate:deploy'" -ForegroundColor Gray
Write-Host "   3. Test health endpoint: curl $serviceUrl/health" -ForegroundColor Gray
