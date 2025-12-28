# Check if orchestrator services are running
# Run this while backend is running

Write-Host "=== Checking Orchestrator Services ===" -ForegroundColor Cyan
Write-Host ""

# Check if backend is responding
Write-Host "1. Testing backend health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method GET -UseBasicParsing -ErrorAction SilentlyContinue
    Write-Host "   ✓ Backend is responding" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Backend not responding at http://localhost:3001" -ForegroundColor Red
    Write-Host "   Make sure backend is running: cd backend; npm start" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "2. Check backend logs for:" -ForegroundColor Yellow
Write-Host "   - [MCP Matcher] Started, listening for user requests..." -ForegroundColor Gray
Write-Host "   - [Server] Execution Coordinator started" -ForegroundColor Gray
Write-Host "   - [Kafka] Producer connected" -ForegroundColor Gray

Write-Host ""
Write-Host "3. When you test with curl, look for these log messages:" -ForegroundColor Yellow
Write-Host "   - [Orchestrator Query] Published request..." -ForegroundColor Gray
Write-Host "   - [MCP Matcher] Processing request..." -ForegroundColor Gray
Write-Host "   - [MCP Matcher] Emitted TOOL_READY..." -ForegroundColor Gray
Write-Host "   - [Orchestrator Coordinator] tool-signals ... invoking..." -ForegroundColor Gray
Write-Host "   - [Orchestrator Coordinator] Publishing result..." -ForegroundColor Gray
Write-Host "   - [Orchestrator Query] Received result event..." -ForegroundColor Gray

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Make sure Kafka is running: docker-compose -f docker-compose.kafka.yml up -d" -ForegroundColor Yellow
Write-Host "2. Make sure backend is running with Kafka enabled (KAFKA_ENABLED=true)" -ForegroundColor Yellow
Write-Host "3. Check backend logs for the messages above" -ForegroundColor Yellow
Write-Host "4. If services aren't starting, check backend/src/server.ts for orchestrator startup" -ForegroundColor Yellow


