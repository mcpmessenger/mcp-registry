# Setup Pulsar namespaces for multi-tenant architecture (Phase III)
# Creates namespaces for users and agents

$PULSAR_CONTAINER = "pulsar-broker"
$PULSAR_HTTP_URL = "http://localhost:8080"

Write-Host "=== Setting up Pulsar Multi-Tenant Namespaces ===" -ForegroundColor Cyan
Write-Host ""

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

# Create shared namespace for registry events
Write-Host ""
Write-Host "Creating shared namespace..." -ForegroundColor Yellow
try {
    docker exec $PULSAR_CONTAINER bin/pulsar-admin namespaces create public/shared/registry 2>&1 | Out-Null
    Write-Host "  [OK] Namespace 'public/shared/registry' created" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Namespace may already exist" -ForegroundColor Yellow
}

# Example: Create namespaces for specific users/agents
# In production, namespaces would be created dynamically when users/agents are registered

Write-Host ""
Write-Host "Example: Creating sample user namespace..." -ForegroundColor Yellow
$sampleUserId = "user-123"
$sampleNamespace = "tenant/$sampleUserId/orchestrator"

try {
    docker exec $PULSAR_CONTAINER bin/pulsar-admin namespaces create $sampleNamespace 2>&1 | Out-Null
    Write-Host "  [OK] Sample namespace '$sampleNamespace' created" -ForegroundColor Green
    
    # Set retention policy (7 days)
    docker exec $PULSAR_CONTAINER bin/pulsar-admin namespaces set-retention $sampleNamespace --size -1 --time 7d 2>&1 | Out-Null
    Write-Host "  [OK] Retention policy set (7 days)" -ForegroundColor Green
    
    # Create topics in namespace
    $topics = @("user-requests", "tool-signals", "orchestrator-results")
    foreach ($topic in $topics) {
        $fullTopic = "persistent://$sampleNamespace/$topic"
        docker exec $PULSAR_CONTAINER bin/pulsar-admin topics create $fullTopic 2>&1 | Out-Null
        Write-Host "  [OK] Topic '$topic' created in namespace" -ForegroundColor Green
    }
} catch {
    Write-Host "  [WARN] Sample namespace may already exist" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Namespace Setup Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Namespaces created:" -ForegroundColor White
Write-Host "  - public/shared/registry (shared topics)" -ForegroundColor Green
Write-Host "  - tenant/user-123/orchestrator (sample user namespace)" -ForegroundColor Green
Write-Host ""
Write-Host "To create namespaces for other users/agents:" -ForegroundColor Cyan
Write-Host "  docker exec $PULSAR_CONTAINER bin/pulsar-admin namespaces create tenant/{user-id}/orchestrator" -ForegroundColor White
Write-Host "  docker exec $PULSAR_CONTAINER bin/pulsar-admin namespaces create tenant/{agent-id}/execution" -ForegroundColor White
Write-Host ""
Write-Host "See docs/PULSAR_MULTI_TENANT.md for details." -ForegroundColor Cyan
