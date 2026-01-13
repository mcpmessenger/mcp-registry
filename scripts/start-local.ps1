# Local Development Startup Script
# Starts Kafka, Backend, and provides instructions for Frontend

Write-Host "🚀 Starting MCP Registry Local Development Environment" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "📦 Checking Docker..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Start Kafka
Write-Host ""
Write-Host "📦 Starting Kafka..." -ForegroundColor Yellow
docker compose -f docker-compose.kafka.yml up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Kafka started successfully" -ForegroundColor Green
    Start-Sleep -Seconds 3
    
    # Verify Kafka is running
    $kafkaRunning = docker ps | Select-String "kafka"
    if ($kafkaRunning) {
        Write-Host "✓ Kafka container is running" -ForegroundColor Green
    } else {
        Write-Host "⚠ Kafka container may not be running. Check with: docker ps" -ForegroundColor Yellow
    }
} else {
    Write-Host "✗ Failed to start Kafka" -ForegroundColor Red
    exit 1
}

# Check backend .env
Write-Host ""
Write-Host "🔧 Checking backend configuration..." -ForegroundColor Yellow
if (Test-Path "backend\.env") {
    $envContent = Get-Content "backend\.env" -Raw
    if ($envContent -match "ENABLE_KAFKA=true" -or $envContent -match "KAFKA_BROKERS") {
        Write-Host "✓ Backend .env has Kafka configuration" -ForegroundColor Green
    } else {
        Write-Host "⚠ Backend .env missing Kafka config. Add:" -ForegroundColor Yellow
        Write-Host "  ENABLE_KAFKA=true" -ForegroundColor Gray
        Write-Host "  KAFKA_BROKERS=localhost:9092" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠ Backend .env not found. Copy from env.example.txt:" -ForegroundColor Yellow
    Write-Host "  cd backend && copy env.example.txt .env" -ForegroundColor Gray
}

# Check if backend dependencies are installed
Write-Host ""
Write-Host "📦 Checking backend dependencies..." -ForegroundColor Yellow
if (Test-Path "backend\node_modules") {
    Write-Host "✓ Backend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "⚠ Backend dependencies not installed. Run:" -ForegroundColor Yellow
    Write-Host "  cd backend && npm install" -ForegroundColor Gray
}

# Check if frontend dependencies are installed
Write-Host ""
Write-Host "📦 Checking frontend dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "✓ Frontend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "⚠ Frontend dependencies not installed. Run:" -ForegroundColor Yellow
    Write-Host "  npm install" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Start backend (in a new terminal):" -ForegroundColor White
Write-Host "   cd backend" -ForegroundColor Gray
Write-Host "   npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Start frontend (in another terminal):" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Open browser:" -ForegroundColor White
Write-Host "   http://localhost:3000/chat" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop Kafka:" -ForegroundColor Yellow
Write-Host "   docker compose -f docker-compose.kafka.yml down" -ForegroundColor Gray
Write-Host ""
