# Native Pulsar Setup (Phase II)

This guide shows how to set up and test native Pulsar without KoP (Kafka-on-Pulsar).

## Why Native Pulsar?

- **Simpler**: No need to install KoP protocol handler
- **Direct**: Use Pulsar's native client library
- **Full Features**: Access to all Pulsar features (namespaces, tiered storage, etc.)
- **Production Ready**: This is the recommended approach for Phase II

## Quick Start

### 1. Start Pulsar

```powershell
docker compose -f docker-compose.pulsar.yml up -d
```

Wait 30-60 seconds for all services to start.

### 2. Verify Pulsar is Running

```powershell
# Check containers
docker ps --filter "name=pulsar"

# Check broker health
curl http://localhost:8080/admin/v2/brokers/health
# Should return: {"status":"ok"}
```

### 3. Create Topics

```powershell
.\scripts\setup-pulsar-topics.ps1
```

### 4. Install Pulsar Client

```powershell
cd backend
pnpm install pulsar-client
```

### 5. Configure Backend

Edit `backend/.env`:

```env
# Enable native Pulsar (NOT KoP)
ENABLE_PULSAR=true

# Pulsar connection
PULSAR_SERVICE_URL=pulsar://localhost:6650
PULSAR_HTTP_URL=http://localhost:8080
PULSAR_NAMESPACE=public/default

# Topic names (same as before)
PULSAR_TOPIC_USER_REQUESTS=user-requests
PULSAR_TOPIC_TOOL_SIGNALS=tool-signals
PULSAR_TOPIC_ORCHESTRATOR_RESULTS=orchestrator-results
```

### 6. Start Backend

```powershell
cd backend
pnpm start
```

Look for:
```
[Pulsar] Client connected
[Pulsar] Producer created for topic: persistent://public/default/user-requests
```

### 7. Test

```powershell
.\scripts\test-orchestrator-pulsar.ps1
```

## What's Different from KoP?

| Feature | KoP (Phase I) | Native Pulsar (Phase II) |
|---------|---------------|--------------------------|
| Client Library | `kafkajs` | `pulsar-client` |
| Protocol | Kafka wire protocol | Pulsar native protocol |
| Port | 9092 | 6650 |
| Setup | Requires KoP installation | Works out of the box |
| Features | Limited to Kafka features | Full Pulsar features |

## Benefits

1. **No Extra Installation**: Standard Pulsar image works
2. **Better Performance**: Native protocol is optimized
3. **Full Feature Access**: Namespaces, tiered storage, etc.
4. **Type Safety**: Better TypeScript support

## Troubleshooting

### Broker Not Starting

```powershell
# Check logs
docker logs pulsar-broker

# Common issues:
# - Zookeeper not ready: Wait longer
# - Port conflicts: Check if 6650 or 8080 are in use
```

### Can't Connect from Backend

```powershell
# Verify Pulsar is accessible
curl http://localhost:8080/admin/v2/brokers/health

# Check backend logs for connection errors
# Look for: [Pulsar] Client connected
```

### Topics Not Found

```powershell
# Create topics manually
.\scripts\setup-pulsar-topics.ps1

# Or via Pulsar admin
docker exec pulsar-broker bin/pulsar-admin topics create persistent://public/default/user-requests
```

## Next Steps

Once native Pulsar is working:

1. **Test Orchestrator**: Run test scripts
2. **Deploy Pulsar Function**: Optional - move matcher to function
3. **Configure Namespaces**: Phase III - multi-tenancy
4. **Set Up Tiered Storage**: Phase III - cost optimization

## Migration Path

If you were using Kafka:

1. ✅ **Stop Kafka**: `docker compose -f docker-compose.kafka.yml down`
2. ✅ **Start Pulsar**: `docker compose -f docker-compose.pulsar.yml up -d`
3. ✅ **Update Backend**: Set `ENABLE_PULSAR=true`
4. ✅ **Test**: Verify everything works

No code changes needed in orchestrator logic - just the client library!
