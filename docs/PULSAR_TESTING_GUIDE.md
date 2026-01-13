# Pulsar Migration Testing Guide

This guide provides step-by-step instructions for testing the Kafka to Pulsar migration.

## Prerequisites

- Docker Desktop running
- Backend dependencies installed (`cd backend && pnpm install`)
- Basic understanding of the orchestrator flow

## Phase I Testing: KoP Bridge (Zero Code Changes)

### Step 1: Start Pulsar with KoP

```powershell
# Start Pulsar cluster
docker compose -f docker-compose.pulsar.yml up -d

# Wait 30-60 seconds for services to initialize
# Verify containers are running
docker ps | Select-String "pulsar"
```

You should see:
- `pulsar-zookeeper`
- `pulsar-bookie`
- `pulsar-broker`

### Step 2: Verify Pulsar Health

```powershell
# Check broker health
curl http://localhost:8080/admin/v2/brokers/health

# Should return: {"status":"ok"}
```

### Step 3: Create Topics

```powershell
# Create Pulsar topics
.\scripts\setup-pulsar-topics.ps1
```

Expected output:
```
Setting up Pulsar namespace and topics...
[OK] Namespace 'public/default' created or already exists
[OK] Topic 'user-requests' created
[OK] Topic 'tool-signals' created
...
```

### Step 4: Test KoP Compatibility

```powershell
# Run KoP compatibility test
.\scripts\test-pulsar-kop.ps1
```

This verifies:
- Pulsar broker is healthy
- Topics can be created via Pulsar admin
- Kafka protocol (KoP) works on port 9092

### Step 5: Configure Backend for KoP

Edit `backend/.env`:

```env
# Enable KoP mode
USE_PULSAR_KOP=true

# Point to Pulsar KoP endpoint (same port as Kafka!)
KAFKA_BROKERS=localhost:9092

# Keep existing Kafka topic names (KoP compatible)
ENABLE_KAFKA=true
KAFKA_TOPIC_USER_REQUESTS=user-requests
KAFKA_TOPIC_TOOL_SIGNALS=tool-signals
KAFKA_TOPIC_ORCHESTRATOR_RESULTS=orchestrator-results
```

### Step 6: Start Backend

```powershell
cd backend
pnpm start
```

Look for these log messages:
```
[Server] Kafka enabled, brokers: localhost:9092
[Server] Starting MCP Matcher...
[Server] ✓ MCP Matcher started successfully
[Server] Starting Execution Coordinator...
[Server] ✓ Execution Coordinator started successfully
```

**Important**: The backend is still using `kafkajs`, but it's connecting to Pulsar via KoP!

### Step 7: Test Orchestrator Endpoint

```powershell
# Test the orchestrator with a simple query
$body = @{
    query = "what's the weather in San Francisco"
    sessionId = "test-session-123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/orchestrator/query" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"
```

Expected response:
```json
{
  "success": true,
  "requestId": "...",
  "result": { ... },
  "tool": "lookup_weather",
  "status": "tool"
}
```

### Step 8: Verify Messages in Pulsar

```powershell
# List topics in Pulsar
docker exec pulsar-broker bin/pulsar-admin topics list public/default

# Check topic stats
docker exec pulsar-broker bin/pulsar-admin topics stats persistent://public/default/user-requests
```

### Step 9: Monitor Logs

```powershell
# Watch Pulsar broker logs
docker logs -f pulsar-broker

# Watch backend logs for orchestrator activity
# Look for:
# - [Ingress] Published user request ...
# - [MCP Matcher] Processing request ...
# - [Orchestrator Coordinator] Publishing result ...
```

## Phase II Testing: Native Pulsar Client

### Step 1: Install Pulsar Client

```powershell
cd backend
pnpm install pulsar-client
```

### Step 2: Enable Native Pulsar

Edit `backend/.env`:

```env
# Enable native Pulsar (not just KoP)
ENABLE_PULSAR=true
PULSAR_SERVICE_URL=pulsar://localhost:6650
PULSAR_HTTP_URL=http://localhost:8080
PULSAR_NAMESPACE=public/default

# Keep topic names
PULSAR_TOPIC_USER_REQUESTS=user-requests
PULSAR_TOPIC_TOOL_SIGNALS=tool-signals
PULSAR_TOPIC_ORCHESTRATOR_RESULTS=orchestrator-results
```

### Step 3: Deploy Pulsar Function (Optional)

```powershell
# Deploy MCP Matcher function
docker exec pulsar-broker bin/pulsar-admin functions create `
    --function-config-file /pulsar/functions/mcp-matcher/config.yaml

# Check function status
docker exec pulsar-broker bin/pulsar-admin functions status `
    --name mcp-matcher `
    --tenant public `
    --namespace default
```

### Step 4: Test Native Pulsar Client

Restart backend and verify it uses Pulsar client:

```powershell
cd backend
pnpm start
```

Look for:
```
[Pulsar] Client connected
[Pulsar] Producer created for topic: persistent://public/default/user-requests
```

### Step 5: Verify Schema Registry

```powershell
# Upload schema for user-requests
docker exec pulsar-broker bin/pulsar-admin schemas upload `
    persistent://public/default/user-requests `
    --filename /pulsar/schemas/user-request-schema.json

# Verify schema
docker exec pulsar-broker bin/pulsar-admin schemas get `
    persistent://public/default/user-requests
```

## Phase III Testing: Multi-Tenancy

### Step 1: Create Namespaces

```powershell
# Run namespace setup script
.\scripts\setup-pulsar-namespaces.ps1
```

### Step 2: Test Namespace Routing

Edit `backend/.env` to enable multi-tenant routing, then test with user context:

```powershell
$body = @{
    query = "what's the weather in New York"
    sessionId = "test-session-123"
    contextSnapshot = @{
        userId = "user-123"
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/orchestrator/query" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"
```

### Step 3: Verify Namespace Isolation

```powershell
# Check that topic exists in user namespace
docker exec pulsar-broker bin/pulsar-admin topics list tenant/user-123/orchestrator

# Verify messages are isolated
docker exec pulsar-broker bin/pulsar-admin topics stats `
    persistent://tenant/user-123/orchestrator/user-requests
```

### Step 4: Test Tiered Storage (GCS)

**Note**: Requires GCS bucket and service account key.

```powershell
# Set tiered storage configuration in docker-compose.pulsar.yml
# Then restart broker:
docker compose -f docker-compose.pulsar.yml restart broker

# Configure namespace for offload
docker exec pulsar-broker bin/pulsar-admin namespaces set-offload-threshold `
    tenant/user-123/orchestrator `
    --size 1G `
    --time 7d

# Check offload status
docker exec pulsar-broker bin/pulsar-admin namespaces stats `
    tenant/user-123/orchestrator
```

## Performance Benchmarking

### Test Latency Comparison

Create a test script to measure round-trip latency:

```powershell
# test-latency.ps1
$iterations = 10
$latencies = @()

for ($i = 1; $i -le $iterations; $i++) {
    $start = Get-Date
    $body = @{ query = "test query $i" } | ConvertTo-Json
    Invoke-RestMethod -Uri "http://localhost:3001/api/orchestrator/query" `
        -Method POST -Body $body -ContentType "application/json" | Out-Null
    $end = Get-Date
    $latency = ($end - $start).TotalMilliseconds
    $latencies += $latency
    Write-Host "Request $i : $latency ms"
}

$avg = ($latencies | Measure-Object -Average).Average
Write-Host "Average latency: $avg ms"
```

**Target**: Sub-50ms average latency

### Test Throughput

```powershell
# Send 100 concurrent requests
1..100 | ForEach-Object -Parallel {
    $body = @{ query = "test $_" } | ConvertTo-Json
    Invoke-RestMethod -Uri "http://localhost:3001/api/orchestrator/query" `
        -Method POST -Body $body -ContentType "application/json"
} -ThrottleLimit 10
```

## Troubleshooting

### Issue: "Connection refused" on port 9092

**Solution**:
```powershell
# Check if Pulsar broker is running
docker ps | Select-String "pulsar-broker"

# Check KoP is enabled in logs
docker logs pulsar-broker | Select-String "kop"
```

### Issue: "Topic not found"

**Solution**:
```powershell
# Create topics manually
.\scripts\setup-pulsar-topics.ps1

# Verify topics exist
docker exec pulsar-broker bin/pulsar-admin topics list public/default
```

### Issue: Backend can't connect to Pulsar

**Solution**:
1. Verify `USE_PULSAR_KOP=true` in `backend/.env`
2. Check `KAFKA_BROKERS=localhost:9092` points to KoP
3. Verify Pulsar broker is healthy: `curl http://localhost:8080/admin/v2/brokers/health`

### Issue: Messages not being consumed

**Solution**:
```powershell
# Check consumer groups
docker exec pulsar-broker bin/pulsar-admin topics subscriptions `
    persistent://public/default/user-requests

# Check backend logs for consumer errors
# Look for: [MCP Matcher] Processing request ...
```

## Success Criteria

### Phase I (KoP Bridge)
- ✅ Pulsar cluster starts successfully
- ✅ Topics created in Pulsar
- ✅ Backend connects via KoP (port 9092)
- ✅ Orchestrator queries work end-to-end
- ✅ Messages visible in Pulsar admin

### Phase II (Native Pulsar)
- ✅ Pulsar client connects successfully
- ✅ Producer/consumer work with native client
- ✅ Schema Registry configured
- ✅ Pulsar Function deployed (optional)

### Phase III (Multi-Tenancy)
- ✅ Namespaces created for users/agents
- ✅ Messages routed to correct namespace
- ✅ Namespace isolation verified
- ✅ Tiered storage configured (if using GCS)

## Next Steps After Testing

1. **Production Deployment**:
   - Deploy Pulsar on GCP (StreamNative Cloud or GKE)
   - Configure production namespaces
   - Set up monitoring and alerts

2. **Performance Tuning**:
   - Optimize Pulsar Function parallelism
   - Tune BookKeeper settings
   - Configure retention policies

3. **Monitoring**:
   - Set up Prometheus/Grafana
   - Configure namespace-level metrics
   - Monitor tiered storage offload

## References

- [Pulsar Setup Guide](./PULSAR_SETUP.md)
- [Migration Summary](./PULSAR_MIGRATION_SUMMARY.md)
- [Kafka Orchestrator](./KAFKA_ORCHESTRATOR.md)
