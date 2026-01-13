# Setup Pulsar topics for the orchestrator
# Requires: Docker with Pulsar running (via docker-compose.pulsar.yml)

$PULSAR_CONTAINER = "pulsar-broker"
$PULSAR_HTTP_URL = "http://localhost:8080"
$NAMESPACE = "public/default"

$topics = @(
    "user-requests",
    "tool-signals",
    "tool-signals-retry-5s",
    "tool-signals-retry-30s",
    "tool-signals-dlq",
    "orchestrator-plans",
    "orchestrator-results"
)

Write-Host "Setting up Pulsar namespace and topics..." -ForegroundColor Green

# Check if Pulsar broker is running
$brokerRunning = docker ps --filter "name=$PULSAR_CONTAINER" --format "{{.Names}}" | Select-String -Pattern $PULSAR_CONTAINER
if (-not $brokerRunning) {
    Write-Host "Error: Pulsar broker container '$PULSAR_CONTAINER' is not running." -ForegroundColor Red
    Write-Host "Start Pulsar with: docker compose -f docker-compose.pulsar.yml up -d" -ForegroundColor Yellow
    exit 1
}

# Wait for Pulsar to be ready
Write-Host "Waiting for Pulsar broker to be ready..." -ForegroundColor Yellow
$maxRetries = 30
$retryCount = 0
$ready = $false

while ($retryCount -lt $maxRetries -and -not $ready) {
    try {
        $response = Invoke-WebRequest -Uri "$PULSAR_HTTP_URL/admin/v2/brokers/health" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $ready = $true
            Write-Host "  [OK] Pulsar broker is ready" -ForegroundColor Green
        }
    } catch {
        $retryCount++
        Start-Sleep -Seconds 2
    }
}

if (-not $ready) {
    Write-Host "Error: Pulsar broker did not become ready in time." -ForegroundColor Red
    exit 1
}

# Create namespace if it doesn't exist (using REST API)
Write-Host "Creating namespace: $NAMESPACE" -ForegroundColor Yellow
try {
    $namespaceParts = $NAMESPACE.Split('/')
    $tenant = $namespaceParts[0]
    $namespaceName = $namespaceParts[1]
    
    $createNamespaceUrl = "$PULSAR_HTTP_URL/admin/v2/namespaces/$tenant/$namespaceName"
    $response = Invoke-WebRequest -Uri $createNamespaceUrl -Method PUT -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 204 -or $response.StatusCode -eq 200) {
        Write-Host "  [OK] Namespace '$NAMESPACE' created or already exists" -ForegroundColor Green
    }
} catch {
    # Namespace might already exist, which is fine
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "  [OK] Namespace '$NAMESPACE' already exists" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Could not create namespace (may already exist): $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Create topics
Write-Host ""
Write-Host "Creating Pulsar topics..." -ForegroundColor Green

foreach ($topic in $topics) {
    Write-Host "Creating topic: $topic" -ForegroundColor Yellow
    
    $fullTopicName = "persistent://$NAMESPACE/$topic"
    
    # Try using pulsar-admin CLI first
    $cmd = "docker exec $PULSAR_CONTAINER bin/pulsar-admin topics create $fullTopicName"
    $result = Invoke-Expression $cmd 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Topic '$topic' created" -ForegroundColor Green
    } else {
        # Topic might already exist, try to check
        $checkCmd = "docker exec $PULSAR_CONTAINER bin/pulsar-admin topics list $NAMESPACE"
        $existingTopics = Invoke-Expression $checkCmd 2>&1
        
        if ($existingTopics -match $topic) {
            Write-Host "  [OK] Topic '$topic' already exists" -ForegroundColor Green
        } else {
            # Try REST API as fallback
            try {
                $createTopicUrl = "$PULSAR_HTTP_URL/admin/v2/persistent/$NAMESPACE/$topic"
                $response = Invoke-WebRequest -Uri $createTopicUrl -Method PUT -ErrorAction Stop
                Write-Host "  [OK] Topic '$topic' created via REST API" -ForegroundColor Green
            } catch {
                if ($_.Exception.Response.StatusCode -eq 409) {
                    Write-Host "  [OK] Topic '$topic' already exists" -ForegroundColor Green
                } else {
                    Write-Host "  [FAIL] Failed to create topic '$topic': $($_.Exception.Message)" -ForegroundColor Red
                }
            }
        }
    }
}

Write-Host ""
Write-Host "Listing all topics in namespace '$NAMESPACE':" -ForegroundColor Green
try {
    docker exec $PULSAR_CONTAINER bin/pulsar-admin topics list $NAMESPACE
} catch {
    Write-Host "Could not list topics (this is OK if topics were created)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Pulsar topics setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Note: For KoP (Kafka-on-Pulsar) compatibility, topics are accessible via:" -ForegroundColor Cyan
Write-Host "  - Kafka protocol: localhost:9092" -ForegroundColor Cyan
Write-Host "  - Pulsar protocol: pulsar://localhost:6650" -ForegroundColor Cyan
Write-Host "  - Topic names: $($topics -join ', ')" -ForegroundColor Cyan
