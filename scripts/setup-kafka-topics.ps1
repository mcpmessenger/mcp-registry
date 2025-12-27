# Setup Kafka topics for the orchestrator
# Requires: Docker with Kafka running (via docker-compose.kafka.yml)

$KAFKA_CONTAINER = "kafka"
$BROKER = "localhost:9092"

$topics = @(
    "user-requests",
    "tool-signals",
    "orchestrator-plans",
    "orchestrator-results"
)

Write-Host "Creating Kafka topics..." -ForegroundColor Green

foreach ($topic in $topics) {
    Write-Host "Creating topic: $topic" -ForegroundColor Yellow
    
    $cmd = "docker exec $KAFKA_CONTAINER kafka-topics --create --topic $topic --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1 --if-not-exists"
    Invoke-Expression $cmd
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Topic '$topic' created or already exists" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Failed to create topic '$topic'" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Listing all topics:" -ForegroundColor Green
docker exec $KAFKA_CONTAINER kafka-topics --list --bootstrap-server localhost:9092

Write-Host ""
Write-Host "Kafka topics setup complete!" -ForegroundColor Green

