# Run Database Migrations on GCP
# This script provides options for running Prisma migrations

$PROJECT_ID = "slashmcp"
$REGION = "us-central1"
$DB_INSTANCE = "mcp-registry-db"

Write-Host "🔄 Database Migration Options" -ForegroundColor Cyan
Write-Host ""

# Get database connection details
$dbConnection = gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)"
$dbPassword = gcloud secrets versions access latest --secret=db-password

Write-Host "Database: $dbConnection" -ForegroundColor Gray
Write-Host ""

# Option 1: Use the automated local script (RECOMMENDED)
Write-Host "✅ Option 1: Automated Local Migration (RECOMMENDED)" -ForegroundColor Green
Write-Host ""
Write-Host "   Run this script for step-by-step guidance:" -ForegroundColor Gray
Write-Host "   .\scripts\run-migrations-local.ps1" -ForegroundColor White
Write-Host ""

# Option 2: Manual Cloud SQL Proxy
Write-Host "Option 2: Manual Cloud SQL Proxy" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Download Cloud SQL Proxy v2:" -ForegroundColor Gray
Write-Host "   https://github.com/GoogleCloudPlatform/cloud-sql-proxy/releases/latest/download/cloud-sql-proxy-windows-amd64.exe" -ForegroundColor White
Write-Host ""
Write-Host "2. Start proxy in separate terminal:" -ForegroundColor Gray
Write-Host "   .\cloud-sql-proxy.exe -instances=$dbConnection=tcp:5432" -ForegroundColor White
Write-Host ""
Write-Host "3. Run migrations:" -ForegroundColor Gray
Write-Host "   cd backend" -ForegroundColor White
Write-Host "   `$env:DATABASE_URL='postgresql://postgres:$dbPassword@localhost:5432/mcp_registry'" -ForegroundColor White
Write-Host "   npm run migrate:deploy" -ForegroundColor White
Write-Host ""

# Option 3: Cloud Run job
Write-Host "Option 3: Cloud Run Job (may have issues)" -ForegroundColor Yellow
Write-Host ""
Write-Host "   gcloud run jobs execute migrate-db --region $REGION --wait" -ForegroundColor White
Write-Host ""

Write-Host "💡 Recommended: Use Option 1 (automated script)" -ForegroundColor Cyan
