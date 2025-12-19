# Fix Prisma Generate EPERM Error and Migration Drift
# This script fixes common Windows/OneDrive issues with Prisma

Write-Host "🔧 Fixing Prisma issues..." -ForegroundColor Cyan

# Step 1: Stop any running Node processes that might be holding Prisma files
Write-Host "`n1. Stopping any running Node processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "   Found $($nodeProcesses.Count) Node process(es), stopping them..." -ForegroundColor Yellow
    $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "   ✅ Node processes stopped" -ForegroundColor Green
} else {
    Write-Host "   ✅ No Node processes running" -ForegroundColor Green
}

# Step 2: Clean up Prisma client files that might be locked
Write-Host "`n2. Cleaning Prisma client files..." -ForegroundColor Yellow
$prismaClientPath = Join-Path $PSScriptRoot "node_modules\.prisma"
if (Test-Path $prismaClientPath) {
    try {
        Remove-Item -Path "$prismaClientPath\client\query_engine-windows.dll.node" -Force -ErrorAction SilentlyContinue
        Remove-Item -Path "$prismaClientPath\client\*.tmp*" -Force -ErrorAction SilentlyContinue
        Write-Host "   ✅ Cleaned Prisma client files" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️  Could not clean some files (may be in use): $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Step 3: Generate Prisma client
Write-Host "`n3. Generating Prisma client..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
npm run prisma:generate

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Prisma client generated successfully" -ForegroundColor Green
} else {
    Write-Host "   ❌ Prisma generate failed. Trying alternative approach..." -ForegroundColor Red
    
    # Try with --skip-generate flag to avoid postinstall hook
    Write-Host "   Retrying with direct Prisma command..." -ForegroundColor Yellow
    npx prisma generate --schema=./prisma/schema.prisma
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Prisma client generated successfully" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Still failing. You may need to:" -ForegroundColor Red
        Write-Host "      - Close any IDEs/editors that might be locking files" -ForegroundColor Yellow
        Write-Host "      - Temporarily pause OneDrive sync" -ForegroundColor Yellow
        Write-Host "      - Run as Administrator" -ForegroundColor Yellow
        exit 1
    }
}

# Step 4: Handle migration drift
Write-Host "`n4. Checking migration status..." -ForegroundColor Yellow
$migrationStatus = npm run prisma:migrate -- status 2>&1
if ($migrationStatus -match "drift|not in sync") {
    Write-Host "   ⚠️  Migration drift detected" -ForegroundColor Yellow
    Write-Host "   Creating new migration for schema changes..." -ForegroundColor Yellow
    
    # Create a new migration with the schema changes
    $migrationName = "add_oauth_federation_metadata"
    Write-Host "   Creating migration: $migrationName" -ForegroundColor Yellow
    
    # Use migrate dev which will create a new migration
    npx prisma migrate dev --name $migrationName --create-only
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Migration created. Review the migration file, then run:" -ForegroundColor Green
        Write-Host "      npm run migrate" -ForegroundColor Cyan
    } else {
        Write-Host "   ⚠️  Migration creation had issues. You may need to reset:" -ForegroundColor Yellow
        Write-Host "      npm run prisma migrate reset  (WARNING: This will delete all data!)" -ForegroundColor Red
        Write-Host "      OR" -ForegroundColor Yellow
        Write-Host "      Manually review and fix migrations" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ✅ Migrations are in sync" -ForegroundColor Green
}

Write-Host "`n✨ Done! You can now try starting the server." -ForegroundColor Green
Write-Host "   Run: npm start" -ForegroundColor Cyan
