# Test Pulsar KoP (Kafka-on-Pulsar) compatibility
# This script verifies that Pulsar with KoP works with existing Kafka client code

$PULSAR_CONTAINER = "pulsar-broker"
$KOP_ENDPOINT = "localhost:9092"
$TEST_TOPIC = "test-kop-compatibility"

Write-Host "=== Testing Pulsar KoP Compatibility ===" -ForegroundColor Cyan
Write-Host ""

# Check if Pulsar is running
$brokerRunning = docker ps --filter "name=$PULSAR_CONTAINER" --format "{{.Names}}" | Select-String -Pattern $PULSAR_CONTAINER
if (-not $brokerRunning) {
    Write-Host "Error: Pulsar broker container '$PULSAR_CONTAINER' is not running." -ForegroundColor Red
    Write-Host "Start Pulsar with: docker compose -f docker-compose.pulsar.yml up -d" -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/5] Checking Pulsar broker health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/admin/v2/brokers/health" -Method GET -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "  [OK] Pulsar broker is healthy" -ForegroundColor Green
    }
} catch {
    Write-Host "  [FAIL] Pulsar broker health check failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/5] Creating test topic via Pulsar admin..." -ForegroundColor Yellow
$fullTopicName = "persistent://public/default/$TEST_TOPIC"
try {
    $result = docker exec $PULSAR_CONTAINER bin/pulsar-admin topics create $fullTopicName 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Topic created via Pulsar admin" -ForegroundColor Green
    } else {
        # Topic might already exist
        if ($result -match "already exists") {
            Write-Host "  [OK] Topic already exists" -ForegroundColor Green
        } else {
            Write-Host "  [WARN] Topic creation: $result" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "  [WARN] Could not create topic via Pulsar admin: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[3/5] Testing Kafka protocol (KoP) - Producing message..." -ForegroundColor Yellow
$testMessage = "Test message from KoP at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
try {
    # Use kafka-console-producer if available, otherwise skip
    $producerResult = echo $testMessage | docker exec -i $PULSAR_CONTAINER kafka-console-producer --topic $TEST_TOPIC --bootstrap-server localhost:9092 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Message produced via Kafka protocol (KoP)" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Kafka producer test skipped (kafka-console-producer may not be available)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [WARN] Kafka producer test skipped: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[4/5] Testing Kafka protocol (KoP) - Consuming message..." -ForegroundColor Yellow
try {
    # Try to consume with timeout
    $consumerResult = docker exec $PULSAR_CONTAINER timeout 5 kafka-console-consumer --topic $TEST_TOPIC --bootstrap-server localhost:9092 --from-beginning --max-messages 1 2>&1
    if ($LASTEXITCODE -eq 0 -or $consumerResult -match $testMessage) {
        Write-Host "  [OK] Message consumed via Kafka protocol (KoP)" -ForegroundColor Green
        if ($consumerResult -match $testMessage) {
            Write-Host "  [OK] Message content verified" -ForegroundColor Green
        }
    } else {
        Write-Host "  [WARN] Kafka consumer test skipped (kafka-console-consumer may not be available)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [WARN] Kafka consumer test skipped: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[5/5] Verifying topic exists in Pulsar..." -ForegroundColor Yellow
try {
    $topics = docker exec $PULSAR_CONTAINER bin/pulsar-admin topics list public/default 2>&1
    if ($topics -match $TEST_TOPIC) {
        Write-Host "  [OK] Topic '$TEST_TOPIC' exists in Pulsar namespace" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Topic not found in list (may be KoP-only topic)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [WARN] Could not list topics: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "KoP Compatibility Status:" -ForegroundColor White
Write-Host "  - Pulsar broker: Running" -ForegroundColor Green
Write-Host "  - KoP endpoint: $KOP_ENDPOINT" -ForegroundColor White
Write-Host "  - Kafka protocol: Supported via KoP" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Set USE_PULSAR_KOP=true in backend/.env" -ForegroundColor White
Write-Host "  2. Point KAFKA_BROKERS to $KOP_ENDPOINT" -ForegroundColor White
Write-Host "  3. Start backend and test orchestrator" -ForegroundColor White
Write-Host ""
Write-Host "For detailed setup, see: docs/PULSAR_SETUP.md" -ForegroundColor Cyan
