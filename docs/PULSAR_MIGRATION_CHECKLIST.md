# Pulsar Migration Checklist ✅

## Migration Status

### ✅ Completed

1. **All Orchestrator Services Migrated**
   - ✅ MCP Matcher (`matcher.ts`) - Supports Pulsar with receive() loop
   - ✅ Execution Coordinator (`coordinator.ts`) - Handles tool signals and plans
   - ✅ Result Consumer (`result-consumer.ts`) - Receives orchestrator results
   - ✅ Retry Worker (`retry-worker.ts`) - Handles delayed retries
   - ✅ Job Result Updater (`job-result-updater.ts`) - Persists results to DB

2. **Infrastructure**
   - ✅ Pulsar client utilities (`pulsar.ts`)
   - ✅ Unified messaging interface (`messaging.ts`) with lazy Kafka imports
   - ✅ Ingress gateway updated for Pulsar
   - ✅ Retry logic supports Pulsar producers
   - ✅ Server startup logic updated

3. **Configuration**
   - ✅ Environment variable support (`ENABLE_PULSAR`, `PULSAR_SERVICE_URL`, etc.)
   - ✅ Topic name resolution helper functions
   - ✅ Kafka initialization guards (skip when Pulsar enabled)

### ⚠️ Testing Required

1. **Backend Startup**
   - [ ] Verify no Kafka connection errors when `ENABLE_PULSAR=true`
   - [ ] Verify all services start successfully
   - [ ] Check debug logs show correct messaging system

2. **Pulsar Connection**
   - [ ] Verify Pulsar client connects to `pulsar://localhost:6650`
   - [ ] Verify topics are created in `public/default` namespace
   - [ ] Check producer/consumer creation logs

3. **End-to-End Flow**
   - [ ] Test user request ingestion via ingress
   - [ ] Verify matcher processes requests and emits tool signals
   - [ ] Verify coordinator invokes tools and publishes results
   - [ ] Verify result consumer receives and resolves results
   - [ ] Verify job result updater persists to database

4. **Error Handling**
   - [ ] Test retry worker with failed tool invocations
   - [ ] Verify DLQ handling for exhausted retries
   - [ ] Check negative acknowledgment for failed messages

## Quick Test Steps

### 1. Start Pulsar
```powershell
docker compose -f docker-compose.pulsar.yml up -d
```

### 2. Create Topics
```powershell
.\scripts\setup-pulsar-topics.ps1
```

### 3. Configure Backend
In `backend/.env`:
```env
ENABLE_PULSAR=true
ENABLE_KAFKA=false
PULSAR_SERVICE_URL=pulsar://localhost:6650
PULSAR_HTTP_URL=http://localhost:8080
PULSAR_NAMESPACE=public/default
```

### 4. Start Backend
```powershell
cd backend
npm start
```

### 5. Verify Startup
Look for:
- ✅ `[Server] Pulsar enabled, service URL: pulsar://localhost:6650`
- ✅ `[Server] Pulsar enabled - starting orchestrator services with Pulsar`
- ✅ `[MCP Matcher] Started (Pulsar), listening for user requests...`
- ✅ `[Orchestrator Coordinator] Started (Pulsar)`
- ❌ No Kafka connection errors

### 6. Test Orchestrator
```powershell
.\scripts\test-orchestrator-pulsar.ps1
```

## Known Issues / Notes

1. **Kafka Module Loading**: Even with lazy imports, if any code path imports `kafka.ts`, it will create a Kafka instance. This is expected behavior - the instance is created but not connected unless `createKafkaProducer()` or `createKafkaConsumer()` is called.

2. **Namespace Routing**: Multi-tenant namespace routing (Phase III) is implemented in ingress but may need topic creation in those namespaces for full testing.

3. **Producer Closing**: Ingress gateway, we create and close producers for each request. Consider connection pooling for production.

## Next Steps After Testing

1. **Performance Testing**: Compare latency/throughput vs Kafka
2. **Multi-Tenancy**: Test namespace isolation (Phase III)
3. **Tiered Storage**: Enable GCS/S3 offloading for execution logs
4. **Monitoring**: Add Pulsar metrics collection
5. **Documentation**: Update API docs with Pulsar-specific features
