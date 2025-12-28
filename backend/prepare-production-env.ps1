# Script to prepare .env file for production deployment
# This updates key values while preserving your existing API keys

$envFile = ".env"
$backupFile = ".env.local"

# Backup current .env
if (Test-Path $envFile) {
    if (!(Test-Path $backupFile)) {
        Copy-Item $envFile $backupFile
        Write-Host "✓ Created backup: $backupFile" -ForegroundColor Green
    }
    
    $content = Get-Content $envFile -Raw
    $originalContent = $content
    
    # Update PORT (Cloud Run uses 8080, but it auto-sets PORT env var)
    # Actually, Cloud Run sets PORT automatically, but we'll leave it as 8080 for clarity
    $content = $content -replace '(?m)^PORT=\d+', 'PORT=8080'
    
    # Update NODE_ENV
    $content = $content -replace '(?m)^NODE_ENV=\w+', 'NODE_ENV=production'
    
    # Update CORS_ORIGIN (placeholder - update after Vercel deployment)
    if ($content -notmatch 'CORS_ORIGIN=') {
        # Add CORS_ORIGIN if it doesn't exist
        $content += "`nCORS_ORIGIN=`"https://your-app.vercel.app`""
    } else {
        # Update existing CORS_ORIGIN, but keep localhost if it's still localhost
        if ($content -match 'CORS_ORIGIN="http://localhost') {
            $content = $content -replace '(?m)^CORS_ORIGIN="http://localhost[^"]*"', 'CORS_ORIGIN="https://your-app.vercel.app"'
        }
    }
    
    # Disable Kafka for initial deployment (unless you have Kafka infrastructure)
    if ($content -match 'ENABLE_KAFKA=') {
        $content = $content -replace '(?m)^ENABLE_KAFKA=\w+', 'ENABLE_KAFKA=false'
    } else {
        # Add ENABLE_KAFKA if it doesn't exist
        $content += "`nENABLE_KAFKA=false"
    }
    
    # Keep DATABASE_URL as-is (deploy script will skip file: paths)
    # DATABASE_URL="file:./dev.db" will be skipped automatically
    
    # Save updated content
    Set-Content -Path $envFile -Value $content -NoNewline
    
    Write-Host "✓ Updated $envFile for production deployment" -ForegroundColor Green
    Write-Host ""
    Write-Host "Changes made:" -ForegroundColor Yellow
    Write-Host "  - PORT=8080 (Cloud Run standard)" -ForegroundColor White
    Write-Host "  - NODE_ENV=production" -ForegroundColor White
    Write-Host "  - CORS_ORIGIN updated to placeholder (update after Vercel deployment)" -ForegroundColor White
    Write-Host "  - ENABLE_KAFKA=false (disable Kafka unless you have infrastructure)" -ForegroundColor White
    Write-Host "  - DATABASE_URL kept as-is (will be skipped by deploy script)" -ForegroundColor White
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: After deploying to Vercel, update CORS_ORIGIN with your actual Vercel URL" -ForegroundColor Yellow
    Write-Host ""
    
} else {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "   Please create .env file first (copy from env.example.txt)" -ForegroundColor Yellow
    exit 1
}

