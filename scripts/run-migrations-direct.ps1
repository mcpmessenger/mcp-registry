# Run Database Migrations via Public IP (Direct Connection)
# This bypasses Cloud SQL Proxy and connects directly

Write-Host "Running Database Migrations via Direct Connection" -ForegroundColor Cyan
Write-Host ""

# Get database details
$publicIp = gcloud sql instances describe mcp-registry-db --format="value(ipAddresses[0].ipAddress)" 2>&1
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($publicIp)) {
    Write-Host "Failed to get public IP. Make sure public IP is enabled on the instance." -ForegroundColor Red
    exit 1
}

Write-Host "Database Public IP: $publicIp" -ForegroundColor Green

# Get password
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
Write-Host "Password retrieved (length: $($dbPassword.Length))" -ForegroundColor Gray

# Build connection string - ensure all variables are properly set
if ([string]::IsNullOrWhiteSpace($publicIp) -or [string]::IsNullOrWhiteSpace($dbPassword)) {
    Write-Host "Error: Missing required values" -ForegroundColor Red
    Write-Host "  Public IP: $publicIp" -ForegroundColor Red
    Write-Host "  Password length: $($dbPassword.Length)" -ForegroundColor Red
    exit 1
}

$databaseUrl = "postgresql://postgres:$dbPassword@${publicIp}:5432/mcp_registry"
Write-Host "Connection configured" -ForegroundColor Green
Write-Host "Connection: postgresql://postgres:***@${publicIp}:5432/mcp_registry" -ForegroundColor Gray
Write-Host "Full URL length: $($databaseUrl.Length) characters" -ForegroundColor Gray
Write-Host ""

# Navigate to backend
$backendPath = Join-Path $PSScriptRoot "..\backend"
Push-Location $backendPath

# Backup and remove interfering files
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
    Write-Host "Temporarily removed .env" -ForegroundColor Gray
}

try {
    $env:DATABASE_URL = $databaseUrl
    Write-Host "Running migrations..." -ForegroundColor Yellow
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
} else {
    Write-Host ""
    Write-Host "Migration failed. You may need to authorize your IP address in Cloud SQL." -ForegroundColor Red
    Write-Host "Go to: https://console.cloud.google.com/sql/instances/mcp-registry-db/connections" -ForegroundColor Yellow
}
