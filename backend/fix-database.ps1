# Fix SQLite Database Path for OneDrive Compatibility
# This script moves the database to a local directory to avoid OneDrive sync issues

Write-Host "Fixing database path for OneDrive compatibility..." -ForegroundColor Cyan

# Create local data directory
$dataDir = Join-Path $PSScriptRoot "data"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir | Out-Null
    Write-Host "[OK] Created data directory: $dataDir" -ForegroundColor Green
}

# Update .env file
$envFile = Join-Path $PSScriptRoot ".env"
$newDbPath = "file:./data/dev.db"

if (Test-Path $envFile) {
    $content = Get-Content $envFile -Raw
    
    if ($content -match 'DATABASE_URL\s*=\s*"file:\./dev\.db"') {
        $content = $content -replace 'DATABASE_URL\s*=\s*"file:\./dev\.db"', "DATABASE_URL=`"$newDbPath`""
        Set-Content -Path $envFile -Value $content -NoNewline
        Write-Host "[OK] Updated DATABASE_URL in .env to: $newDbPath" -ForegroundColor Green
    } elseif ($content -notmatch 'DATABASE_URL') {
        $content += "`nDATABASE_URL=`"$newDbPath`""
        Set-Content -Path $envFile -Value $content -NoNewline
        Write-Host "[OK] Added DATABASE_URL to .env: $newDbPath" -ForegroundColor Green
    } else {
        Write-Host "[WARN] DATABASE_URL already exists in .env, please update manually to: $newDbPath" -ForegroundColor Yellow
    }
} else {
    # Create .env file with default values
    $envContent = "DATABASE_URL=`"$newDbPath`"`nPORT=3001`nNODE_ENV=development`nCORS_ORIGIN=http://localhost:3000`nGOOGLE_VISION_API_KEY=`nGOOGLE_GEMINI_API_KEY="
    Set-Content -Path $envFile -Value $envContent
    Write-Host "[OK] Created .env file with DATABASE_URL: $newDbPath" -ForegroundColor Green
}

# Clean up old database files in prisma directory
$prismaDir = Join-Path $PSScriptRoot "prisma"
if (Test-Path $prismaDir) {
    Get-ChildItem -Path $prismaDir -Filter "*.db*" | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "[OK] Cleaned up old database files" -ForegroundColor Green
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run: npm run migrate" -ForegroundColor White
Write-Host "  2. Run: npm run seed" -ForegroundColor White
Write-Host "  3. Run: npm start" -ForegroundColor White
