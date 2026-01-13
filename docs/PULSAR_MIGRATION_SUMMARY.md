# Kafka to Pulsar Migration Summary

This document provides a comprehensive summary of the migration from Apache Kafka to Apache Pulsar for the MCP Orchestrator infrastructure.

## Migration Status

✅ **Phase I: Bridge with KoP** - COMPLETE
✅ **Phase II: Refactor to Pulsar Functions** - COMPLETE
✅ **Phase III: Isolation with Tiered Storage** - COMPLETE

## What Was Implemented

### Phase I: KoP Bridge

**Objective**: Enable existing Kafka client code to work with Pulsar via KoP protocol handler.

**Deliverables**:
- ✅ `docker-compose.pulsar.yml` - Pulsar cluster with KoP enabled
- ✅ `backend/src/config/env.ts` - Pulsar configuration support
- ✅ `scripts/setup-pulsar-topics.ps1` - Topic creation script
- ✅ `scripts/test-pulsar-kop.ps1` - KoP compatibility test
- ✅ `docs/PULSAR_SETUP.md` - Setup documentation

**Key Features**:
- KoP listens on port 9092 (same as Kafka) for compatibility
- Existing `kafkajs` client works without code changes
- Zero-downtime migration path

### Phase II: Pulsar Functions & Native Client

**Objective**: Migrate tool-matching logic to Pulsar Functions and native Pulsar client.

**Deliverables**:
- ✅ `functions/mcp-matcher/` - Pulsar Function for MCP Matcher
- ✅ `backend/src/services/orchestrator/pulsar.ts` - Native Pulsar client
- ✅ `backend/src/services/orchestrator/messaging.ts` - Unified messaging interface
- ✅ `backend/src/services/orchestrator/ingress.ts` - Updated for Pulsar support
- ✅ `schemas/` - Event schemas for Schema Registry
- ✅ `docs/PULSAR_SCHEMA_REGISTRY.md` - Schema documentation

**Key Features**:
- Pulsar Function runs matcher logic on brokers (reduced latency)
- Native `pulsar-client` npm package integration
- Schema Registry support for type safety

### Phase III: Multi-Tenancy & Tiered Storage

**Objective**: Implement namespace isolation and tiered storage for cost optimization.

**Deliverables**:
- ✅ `docs/PULSAR_MULTI_TENANT.md` - Multi-tenant architecture guide
- ✅ `scripts/setup-pulsar-namespaces.ps1` - Namespace setup script
- ✅ `docker-compose.pulsar.yml` - Tiered storage configuration
- ✅ `docs/PULSAR_TIERED_STORAGE.md` - Tiered storage guide
- ✅ Updated ingress gateway with namespace routing

**Key Features**:
- Hierarchical namespace structure: `tenant/{user-id}/orchestrator`
- Per-tenant isolation for execution logs
- GCS/S3 tiered storage for cost reduction (30-50% savings)

## File Structure

```
.
├── docker-compose.pulsar.yml          # Pulsar cluster with KoP
├── functions/
│   └── mcp-matcher/                  # Pulsar Function
│       ├── function.py
│       ├── requirements.txt
│       ├── config.yaml
│       └── README.md
├── schemas/                          # Event schemas
│   ├── user-request-schema.json
│   └── tool-signal-schema.json
├── scripts/
│   ├── setup-pulsar-topics.ps1      # Topic creation
│   ├── setup-pulsar-namespaces.ps1  # Namespace setup
│   └── test-pulsar-kop.ps1          # KoP testing
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── env.ts               # Pulsar config
│   │   └── services/
│   │       └── orchestrator/
│   │           ├── kafka.ts          # Kafka client (Phase I)
│   │           ├── pulsar.ts         # Pulsar client (Phase II)
│   │           ├── messaging.ts      # Unified interface
│   │           └── ingress.ts        # Updated routing
│   └── package.json                 # Added pulsar-client
└── docs/
    ├── PULSAR_SETUP.md
    ├── PULSAR_SCHEMA_REGISTRY.md
    ├── PULSAR_MULTI_TENANT.md
    ├── PULSAR_TIERED_STORAGE.md
    └── PULSAR_MIGRATION_SUMMARY.md   # This file
```

## Quick Start

### Phase I: KoP Bridge (Zero Code Changes)

```bash
# 1. Start Pulsar with KoP
docker compose -f docker-compose.pulsar.yml up -d

# 2. Create topics
.\scripts\setup-pulsar-topics.ps1

# 3. Configure backend .env
USE_PULSAR_KOP=true
KAFKA_BROKERS=localhost:9092  # KoP endpoint

# 4. Start backend (existing code works!)
cd backend && pnpm start
```

### Phase II: Native Pulsar Client

```bash
# 1. Install pulsar-client
cd backend && pnpm install

# 2. Enable native Pulsar
ENABLE_PULSAR=true
PULSAR_SERVICE_URL=pulsar://localhost:6650

# 3. Deploy Pulsar Function
pulsar-admin functions create --function-config-file functions/mcp-matcher/config.yaml
```

### Phase III: Multi-Tenancy

```bash
# 1. Create namespaces
.\scripts\setup-pulsar-namespaces.ps1

# 2. Configure tiered storage (GCS)
TIERED_STORAGE_ENABLED=true
TIERED_STORAGE_GCS_BUCKET=my-pulsar-logs

# 3. Set namespace policies
pulsar-admin namespaces set-offload-threshold \
  tenant/user-123/orchestrator \
  --size 1G --time 7d
```

## Configuration Reference

### Environment Variables

```env
# Phase I: KoP Bridge
USE_PULSAR_KOP=true
KAFKA_BROKERS=localhost:9092

# Phase II: Native Pulsar
ENABLE_PULSAR=true
PULSAR_SERVICE_URL=pulsar://localhost:6650
PULSAR_HTTP_URL=http://localhost:8080
PULSAR_NAMESPACE=public/default

# Phase III: Tiered Storage
TIERED_STORAGE_ENABLED=true
TIERED_STORAGE_PROVIDER=gcs
TIERED_STORAGE_GCS_BUCKET=my-pulsar-logs
```

## Migration Path

### Current State (Kafka)

- ✅ Kafka cluster running
- ✅ Orchestrator using `kafkajs`
- ✅ Topics: `user-requests`, `tool-signals`, etc.

### Phase I (KoP Bridge)

- ✅ Pulsar with KoP deployed
- ✅ Point `KAFKA_BROKERS` to KoP endpoint
- ✅ Existing code works without changes
- ✅ Can run Kafka and Pulsar in parallel

### Phase II (Native Pulsar)

- ✅ Pulsar Function deployed
- ✅ Native `pulsar-client` integrated
- ✅ Schema Registry configured
- ✅ Can disable Kafka matcher service

### Phase III (Multi-Tenancy)

- ✅ Namespace routing implemented
- ✅ Tiered storage configured
- ✅ Per-tenant isolation enabled
- ✅ Can decommission Kafka

## Testing

### Phase I Testing

```bash
# Test KoP compatibility
.\scripts\test-pulsar-kop.ps1

# Verify topics exist
docker exec pulsar-broker bin/pulsar-admin topics list public/default
```

### Phase II Testing

```bash
# Test Pulsar Function
pulsar-admin functions status --name mcp-matcher

# Test native client
# (Run orchestrator and verify Pulsar client works)
```

### Phase III Testing

```bash
# Test namespace routing
# (Send request with user_id, verify namespace)

# Test tiered storage
pulsar-admin namespaces stats tenant/user-123/orchestrator
```

## Performance Metrics

### Target Metrics

- **Latency**: Sub-50ms tool routing (maintained)
- **Throughput**: 10x current load capacity
- **Cost**: 30-50% reduction in storage costs
- **Isolation**: Zero cross-tenant data access

### Benchmarking

Run latency benchmarks comparing:
- Kafka native
- Pulsar KoP
- Pulsar native

## Rollback Plan

Each phase supports rollback:

1. **Phase I**: Switch `KAFKA_BROKERS` back to Kafka cluster
2. **Phase II**: Disable Pulsar Function, re-enable Kafka matcher
3. **Phase III**: Route all traffic to `public/default` namespace

## Next Steps

1. **Production Deployment**:
   - Deploy Pulsar cluster on GCP (StreamNative Cloud or GKE)
   - Configure GCS tiered storage
   - Set up monitoring and alerts

2. **Performance Tuning**:
   - Optimize Pulsar Function parallelism
   - Tune BookKeeper settings
   - Configure retention policies

3. **Monitoring**:
   - Set up Prometheus/Grafana for Pulsar metrics
   - Configure namespace-level alerts
   - Monitor tiered storage offload

## References

- [Pulsar Setup Guide](./PULSAR_SETUP.md)
- [Schema Registry](./PULSAR_SCHEMA_REGISTRY.md)
- [Multi-Tenant Architecture](./PULSAR_MULTI_TENANT.md)
- [Tiered Storage](./PULSAR_TIERED_STORAGE.md)
- [Kafka Orchestrator](./KAFKA_ORCHESTRATOR.md)

## Support

For issues or questions:
1. Check relevant documentation in `docs/`
2. Review Pulsar logs: `docker logs pulsar-broker`
3. Test KoP compatibility: `.\scripts\test-pulsar-kop.ps1`
