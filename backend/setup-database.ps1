# Database Setup Script for MCP Registry
# This script helps you set up either PostgreSQL (Docker) or SQLite

Write-Host "🔧 MCP Registry Database Setup" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is available
$dockerAvailable = $false
try {
    docker --version | Out-Null
    $dockerAvailable = $true
    Write-Host "✅ Docker detected" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Docker not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Choose database option:" -ForegroundColor Cyan
Write-Host "1. PostgreSQL (Docker) - Recommended for production-like setup"
Write-Host "2. SQLite - Quick setup, no server needed"
Write-Host ""

$choice = Read-Host "Enter choice [1 or 2]"

if ($choice -eq "1" -and $dockerAvailable) {
    Write-Host ""
    Write-Host "🐘 Setting up PostgreSQL with Docker..." -ForegroundColor Yellow
    
    # Check if container already exists
    $existing = docker ps -a --filter "name=mcp-postgres" --format "{{.Names}}"
    
    if ($existing -eq "mcp-postgres") {
        Write-Host "📦 PostgreSQL container exists, starting it..." -ForegroundColor Yellow
        docker start mcp-postgres
    } else {
        Write-Host "📦 Creating PostgreSQL container..." -ForegroundColor Yellow
        docker run --name mcp-postgres `
          -e POSTGRES_PASSWORD=postgres `
          -e POSTGRES_DB=mcp_registry `
          -p 5432:5432 `
          -d postgres:15-alpine
        
        Write-Host "⏳ Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
    
    # Update .env file
    $envPath = Join-Path $PSScriptRoot ".env"
    $envContent = @"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mcp_registry"
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
GOOGLE_GEMINI_API_KEY=
GOOGLE_VISION_API_KEY=
OPENAI_API_KEY=
ENCRYPTION_SECRET=$(openssl rand -base64 32 2>$null)
ENCRYPTION_SALT=$(openssl rand -base64 32 2>$null)
KAFKA_BROKERS=localhost:9092
"@
    
    if (Test-Path $envPath) {
        # Update existing .env
        $current = Get-Content $envPath -Raw
        if ($current -match 'DATABASE_URL\s*=') {
            $current = $current -replace 'DATABASE_URL\s*=.*', "DATABASE_URL=`"postgresql://postgres:postgres@localhost:5432/mcp_registry`""
            Set-Content $envPath $current
        } else {
            Add-Content $envPath "`nDATABASE_URL=`"postgresql://postgres:postgres@localhost:5432/mcp_registry`""
        }
    } else {
        Set-Content $envPath $envContent
    }
    
    Write-Host "✅ PostgreSQL setup complete!" -ForegroundColor Green
    Write-Host "   Database: mcp_registry" -ForegroundColor Gray
    Write-Host "   User: postgres" -ForegroundColor Gray
    Write-Host "   Password: postgres" -ForegroundColor Gray
    Write-Host "   Port: 5432" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📝 Updated .env file with PostgreSQL connection" -ForegroundColor Green
    
} elseif ($choice -eq "2" -or (-not $dockerAvailable)) {
    Write-Host ""
    Write-Host "💾 Setting up SQLite..." -ForegroundColor Yellow
    
    # Create data directory
    $dataDir = Join-Path $PSScriptRoot "data"
    if (-not (Test-Path $dataDir)) {
        New-Item -ItemType Directory -Path $dataDir | Out-Null
    }
    
    # Update schema to use SQLite
    $schemaPath = Join-Path $PSScriptRoot "prisma\schema.prisma"
    $schemaContent = Get-Content $schemaPath -Raw
    $schemaContent = $schemaContent -replace 'provider = "postgresql"', 'provider = "sqlite"'
    Set-Content $schemaPath $schemaContent
    
    # Update .env file
    $envPath = Join-Path $PSScriptRoot ".env"
    $dbPath = Join-Path $dataDir "dev.db"
    $envContent = @"
DATABASE_URL="file:$dbPath"
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
GOOGLE_GEMINI_API_KEY=
GOOGLE_VISION_API_KEY=
OPENAI_API_KEY=
ENCRYPTION_SECRET=$(openssl rand -base64 32 2>$null)
ENCRYPTION_SALT=$(openssl rand -base64 32 2>$null)
KAFKA_BROKERS=localhost:9092
"@
    
    if (Test-Path $envPath) {
        $current = Get-Content $envPath -Raw
        if ($current -match 'DATABASE_URL\s*=') {
            $current = $current -replace 'DATABASE_URL\s*=.*', "DATABASE_URL=`"file:$dbPath`""
            Set-Content $envPath $current
        } else {
            Add-Content $envPath "`nDATABASE_URL=`"file:$dbPath`""
        }
    } else {
        Set-Content $envPath $envContent
    }
    
    Write-Host "✅ SQLite setup complete!" -ForegroundColor Green
    Write-Host "   Database: $dbPath" -ForegroundColor Gray
    Write-Host "   Schema updated to use SQLite" -ForegroundColor Gray
} else {
    Write-Host "❌ Docker required for PostgreSQL option" -ForegroundColor Red
    Write-Host "   Install Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "🚀 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Run migration: npm run migrate" -ForegroundColor White
Write-Host "   2. Start server: npm start" -ForegroundColor White
