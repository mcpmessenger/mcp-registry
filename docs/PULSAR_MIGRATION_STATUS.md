# Pulsar Migration Status

## Current Status

### ✅ Completed

1. **Phase I: KoP Bridge Infrastructure**
   - ✅ Pulsar cluster with KoP configured (docker-compose.pulsar.yml)
   - ✅ Environment configuration for Pulsar/KoP
   - ✅ Topic creation scripts
   - ✅ Documentation

2. **Phase II: Native Pulsar Client**
   - ✅ Pulsar client library installed (`pulsar-client`)
   - ✅ Pulsar client utilities (`backend/src/services/orchestrator/pulsar.ts`)
   - ✅ Unified messaging interface (`messaging.ts`)
   - ✅ Ingress gateway updated for Pulsar support
   - ✅ Schema Registry schemas created

3. **Phase III: Multi-Tenancy**
   - ✅ Namespace routing logic in ingress
   - ✅ Documentation for multi-tenant architecture
   - ✅ Tiered storage configuration (commented out for now)

### ⚠️ In Progress / Needs Work

**Orchestrator Services Migration**: The following services still use Kafka clients directly and need to be migrated to use Pulsar:

1. **MCP Matcher** (`backend/src/services/orchestrator/matcher.ts`)
   - Currently uses: `createKafkaProducer()`, `createKafkaConsumer()`
   - Needs: Update to use unified messaging interface or Pulsar clients

2. **Execution Coordinator** (`backend/src/services/orchestrator/coordinator.ts`)
   - Currently uses: `createKafkaConsumer()`, `createKafkaProducer()`
   - Needs: Update to use Pulsar consumers/producers

3. **Result Consumer** (`backend/src/services/orchestrator/result-consumer.ts`)
   - Currently uses: `createKafkaConsumer()`
   - Needs: Update to use Pulsar consumer

4. **Retry Worker** (`backend/src/services/orchestrator/retry-worker.ts`)
   - Currently uses: Kafka clients
   - Needs: Pulsar migration

5. **Job Result Updater** (`backend/src/services/orchestrator/job-result-updater.ts`)
   - Currently uses: Kafka clients
   - Needs: Pulsar migration

## Quick Fix Applied

The server now checks for Pulsar first and won't start Kafka services when `ENABLE_PULSAR=true`. However, the orchestrator services themselves still need to be migrated to use Pulsar clients.

## Next Steps

### Option 1: Complete Pulsar Migration (Recommended)

Update all orchestrator services to use Pulsar clients:

1. **Update Matcher**: Replace Kafka consumer/producer with Pulsar equivalents
2. **Update Coordinator**: Use Pulsar consumer for tool-signals and orchestrator-plans
3. **Update Result Consumer**: Use Pulsar consumer for orchestrator-results
4. **Update Retry Worker**: Use Pulsar for retry topics
5. **Update Job Result Updater**: Use Pulsar consumer

### Option 2: Use KoP for Now (Temporary)

If you want to test immediately without migrating services:

1. Install KoP protocol handler (see `docs/PULSAR_KOP_INSTALLATION.md`)
2. Set `USE_PULSAR_KOP=true` (not `ENABLE_PULSAR=true`)
3. Point `KAFKA_BROKERS=localhost:9092` to Pulsar KoP endpoint
4. Existing Kafka client code will work via KoP

### Option 3: Keep Kafka Running

For now, you can keep using Kafka while we complete the Pulsar migration:

1. Start Kafka: `docker compose -f docker-compose.kafka.yml up -d`
2. Set `ENABLE_KAFKA=true` in backend `.env`
3. Keep `ENABLE_PULSAR=false`

## Testing

Once services are migrated to Pulsar:

1. Set `ENABLE_PULSAR=true` in backend `.env`
2. Set `ENABLE_KAFKA=false`
3. Start backend: `cd backend && npm start`
4. Run tests: `.\scripts\test-orchestrator-pulsar.ps1`

## Files That Need Updates

- `backend/src/services/orchestrator/matcher.ts` - Use Pulsar consumer/producer
- `backend/src/services/orchestrator/coordinator.ts` - Use Pulsar consumer/producer  
- `backend/src/services/orchestrator/result-consumer.ts` - Use Pulsar consumer
- `backend/src/services/orchestrator/retry-worker.ts` - Use Pulsar clients
- `backend/src/services/orchestrator/job-result-updater.ts` - Use Pulsar consumer

## Reference

- [Pulsar Native Setup](./PULSAR_NATIVE_SETUP.md)
- [Pulsar Testing Guide](./PULSAR_TESTING_GUIDE.md)
- [Migration Summary](./PULSAR_MIGRATION_SUMMARY.md)
