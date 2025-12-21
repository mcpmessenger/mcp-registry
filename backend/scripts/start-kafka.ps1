# PowerShell script to start Kafka using Docker Compose
# This script checks if Kafka is running and starts it if needed

Write-Host "🔍 Checking if Kafka is running..." -ForegroundColor Cyan

# Check if Kafka container is running
$kafkaRunning = docker ps --filter "name=kafka" --format "{{.Names}}" | Select-String -Pattern "kafka"

if ($kafkaRunning) {
    Write-Host "✅ Kafka is already running" -ForegroundColor Green
    exit 0
}

Write-Host "🚀 Starting Kafka with Docker Compose..." -ForegroundColor Yellow

# Navigate to project root (where docker-compose.kafka.yml is)
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

# Start Kafka using docker-compose
try {
    docker-compose -f docker-compose.kafka.yml up -d
    
    Write-Host "⏳ Waiting for Kafka to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Check if Kafka is now running
    $kafkaRunning = docker ps --filter "name=kafka" --format "{{.Names}}" | Select-String -Pattern "kafka"
    
    if ($kafkaRunning) {
        Write-Host "✅ Kafka started successfully!" -ForegroundColor Green
        Write-Host "   Kafka broker: localhost:9092" -ForegroundColor Gray
        exit 0
    } else {
        Write-Host "⚠️  Kafka container started but may not be ready yet" -ForegroundColor Yellow
        Write-Host "   The backend will retry connection..." -ForegroundColor Gray
        exit 0
    }
} catch {
    Write-Host "❌ Failed to start Kafka: $_" -ForegroundColor Red
    Write-Host "   Make sure Docker is running and docker-compose is available" -ForegroundColor Yellow
    Write-Host "   You can start Kafka manually with:" -ForegroundColor Yellow
    Write-Host "   docker-compose -f docker-compose.kafka.yml up -d" -ForegroundColor Gray
    exit 1
}
