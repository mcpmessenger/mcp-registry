# Run Database Migrations Locally with Cloud SQL Proxy
# This script helps you run Prisma migrations against Cloud SQL

$PROJECT_ID = "slashmcp"
$REGION = "us-central1"
$DB_INSTANCE = "mcp-registry-db"
$DB_CONNECTION = "$PROJECT_ID`:$REGION`:$DB_INSTANCE"

Write-Host "Running Database Migrations Locally" -ForegroundColor Cyan
Write-Host ""

# Check if Cloud SQL Proxy exists
$proxyPath = Join-Path $PSScriptRoot "..\cloud-sql-proxy.exe"
if (-not (Test-Path $proxyPath)) {
    Write-Host "Cloud SQL Proxy not found at: $proxyPath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Download it from:" -ForegroundColor Gray
    Write-Host "  https://github.com/GoogleCloudPlatform/cloud-sql-proxy/releases/latest" -ForegroundColor White
    exit 1
}

# Get database password
Write-Host "Getting database password..." -ForegroundColor Yellow
$passwordOutput = gcloud secrets versions access latest --secret=db-password 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to get database password" -ForegroundColor Red
    Write-Host "Error: $passwordOutput" -ForegroundColor Red
    exit 1
}
$dbPassword = $passwordOutput.ToString().Trim()
if ([string]::IsNullOrWhiteSpace($dbPassword)) {
    Write-Host "Password is empty" -ForegroundColor Red
    exit 1
}
Write-Host "Password retrieved" -ForegroundColor Gray

# Check if proxy is already running on port 5432
$port5432InUse = Get-NetTCPConnection -LocalPort 5432 -ErrorAction SilentlyContinue
if ($port5432InUse) {
    Write-Host "Cloud SQL Proxy already running on port 5432!" -ForegroundColor Green
    $proxyPort = 5432
} else {
    Write-Host "Port 5432 not in use, will use port 5433" -ForegroundColor Yellow
    $proxyPort = 5433
}

# Build DATABASE_URL
# The password is alphanumeric, so no encoding needed
# If it had special chars, we'd need to URL-encode them
$databaseUrl = "postgresql://postgres:$dbPassword@localhost:$proxyPort/mcp_registry"
Write-Host "Database connection configured" -ForegroundColor Green
Write-Host "Connection format: postgresql://postgres:***@localhost:$proxyPort/mcp_registry" -ForegroundColor Gray
Write-Host "Password length: $($dbPassword.Length) characters" -ForegroundColor Gray
Write-Host ""

# Check if proxy is already running
$proxyRunning = Get-Process -Name "cloud-sql-proxy" -ErrorAction SilentlyContinue
if (-not $proxyRunning) {
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Open a NEW PowerShell terminal and run the proxy (keep it running):" -ForegroundColor Yellow
    Write-Host "   cd $PSScriptRoot\.." -ForegroundColor White
    Write-Host "   .\cloud-sql-proxy.exe -instances=$DB_CONNECTION=tcp:$proxyPort" -ForegroundColor White
    Write-Host ""
    Write-Host "2. Once you see 'Ready for new connections', come back here and press Enter..." -ForegroundColor Yellow
    Read-Host "Press Enter when proxy is ready"
} else {
    Write-Host "Cloud SQL Proxy is already running!" -ForegroundColor Green
    Write-Host ""
}

# Run migrations
Write-Host ""
Write-Host "Running migrations..." -ForegroundColor Yellow
$backendPath = Join-Path $PSScriptRoot "..\backend"
Push-Location $backendPath

# Set environment variable
$env:DATABASE_URL = $databaseUrl
Write-Host "DATABASE_URL environment variable set" -ForegroundColor Gray

# Backup and modify files that might interfere
$configPath = Join-Path $backendPath "prisma.config.ts"
$configBackup = Join-Path $backendPath "prisma.config.ts.bak"
$envPath = Join-Path $backendPath ".env"
$envBackup = Join-Path $backendPath ".env.bak"

if (Test-Path $configPath) {
    Copy-Item $configPath $configBackup -Force
    Remove-Item $configPath -Force
    Write-Host "Temporarily disabled prisma.config.ts" -ForegroundColor Gray
}

if (Test-Path $envPath) {
    Copy-Item $envPath $envBackup -Force
    Remove-Item $envPath -Force
    Write-Host "Temporarily renamed .env to prevent Prisma from loading it" -ForegroundColor Gray
}

try {
    Write-Host "Executing: npx prisma migrate deploy --schema=./prisma/schema.prisma" -ForegroundColor Gray
    npx prisma migrate deploy --schema=./prisma/schema.prisma
    $migrationResult = $LASTEXITCODE
} finally {
    if (Test-Path $configBackup) {
        Copy-Item $configBackup $configPath -Force
        Remove-Item $configBackup -Force
        Write-Host "Restored prisma.config.ts" -ForegroundColor Gray
    }
    if (Test-Path $envBackup) {
        Copy-Item $envBackup $envPath -Force
        Remove-Item $envBackup -Force
        Write-Host "Restored .env" -ForegroundColor Gray
    }
}

Pop-Location

if ($migrationResult -eq 0) {
    Write-Host ""
    Write-Host "Migrations completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your database is now set up and ready!" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "Migration failed. Check the error above." -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "  - Make sure Cloud SQL Proxy is running and shows 'Ready for new connections'" -ForegroundColor Gray
    Write-Host "  - Verify the database password is correct" -ForegroundColor Gray
    Write-Host "  - Check that the proxy is listening on the correct port ($proxyPort)" -ForegroundColor Gray
}
