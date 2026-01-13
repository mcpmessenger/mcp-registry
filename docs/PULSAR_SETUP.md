# Pulsar Setup Guide

This guide explains how to set up Apache Pulsar with KoP (Kafka-on-Pulsar) for the MCP Orchestrator.

**Status: 🚧 Migration in Progress** - Phase I: Bridge with KoP enables existing Kafka client code to work with Pulsar without code changes.

## Overview

Apache Pulsar with KoP (Kafka-on-Pulsar) allows existing Kafka clients to connect to Pulsar using the Kafka protocol. This enables a zero-code-change migration path from Kafka to Pulsar.

### Key Benefits

- **Zero Code Changes**: Existing `kafkajs` client code works with Pulsar via KoP
- **Multi-Tenancy**: Native namespace support for isolated environments
- **Segmented Architecture**: Separated compute (brokers) and storage (bookies)
- **Future-Proof**: Foundation for Pulsar Functions and tiered storage

## Option 1: Docker (Recommended)

The easiest way to run Pulsar with KoP on Windows is using Docker.

**Important**: The standard Pulsar image does not include KoP by default. You have two options:

1. **Install KoP manually** (see [KoP Installation Guide](./PULSAR_KOP_INSTALLATION.md))
2. **Test native Pulsar first** (Phase II) - skip KoP and use `ENABLE_PULSAR=true` instead of `USE_PULSAR_KOP=true`

### Prerequisites

- Docker Desktop installed and running
- At least 8GB RAM available
- 10GB free disk space

### Steps

1. **Start Pulsar cluster:**
   ```powershell
   docker compose -f docker-compose.pulsar.yml up -d
   ```

2. **Wait for services to be ready** (about 30-60 seconds):
   - Zookeeper initializes first
   - Pulsar cluster metadata is initialized
   - Bookie (storage) starts
   - Broker with KoP starts last

3. **Verify Pulsar is running:**
   ```powershell
   docker ps
   ```
   You should see:
   - `pulsar-zookeeper`
   - `pulsar-bookie`
   - `pulsar-broker`

4. **Create required topics:**
   ```powershell
   .\scripts\setup-pulsar-topics.ps1
   ```

5. **Configure your backend `.env` file:**
   ```env
   # Enable Pulsar/KoP mode
   USE_PULSAR_KOP=true
   # OR
   ENABLE_PULSAR=true
   
   # KoP listens on port 9092 (same as Kafka) for compatibility
   KAFKA_BROKERS=localhost:9092
   # OR explicitly set KoP brokers
   PULSAR_KOP_BROKERS=localhost:9092
   
   # Pulsar native protocol (for future use)
   PULSAR_SERVICE_URL=pulsar://localhost:6650
   PULSAR_HTTP_URL=http://localhost:8080
   
   # Namespace (default: public/default)
   PULSAR_NAMESPACE=public/default
   
   # Topic names (same as Kafka for compatibility)
   KAFKA_TOPIC_USER_REQUESTS=user-requests
   KAFKA_TOPIC_TOOL_SIGNALS=tool-signals
   KAFKA_TOPIC_ORCHESTRATOR_RESULTS=orchestrator-results
   ```

6. **Start your backend:**
   ```powershell
   cd backend
   pnpm start
   ```

7. **Stop Pulsar when done:**
   ```powershell
   docker compose -f docker-compose.pulsar.yml down
   ```

## Option 2: GCP Managed Pulsar (Production)

For production deployments on GCP:

1. **StreamNative Cloud** (Recommended):
   - Sign up at https://streamnative.io/cloud
   - Create a Pulsar cluster
   - Enable KoP protocol handler
   - Get connection details (service URL, HTTP URL, KoP endpoint)

2. **Self-Managed on GKE**:
   - Deploy Pulsar cluster on Google Kubernetes Engine
   - Use Helm charts: https://github.com/apache/pulsar-helm-chart
   - Enable KoP in broker configuration

3. **Update environment variables:**
   ```env
   USE_PULSAR_KOP=true
   KAFKA_BROKERS=<kop-endpoint>:9092
   PULSAR_SERVICE_URL=pulsar://<broker-endpoint>:6650
   PULSAR_HTTP_URL=https://<admin-endpoint>:8080
   ```

## KoP Protocol Handler

KoP (Kafka-on-Pulsar) enables Kafka clients to connect to Pulsar:

- **Port**: 9092 (same as Kafka default)
- **Protocol**: Kafka wire protocol
- **Compatibility**: Works with existing `kafkajs` client library
- **Topics**: Accessible via both Kafka and Pulsar protocols

### Topic Naming

Pulsar topics use the format: `persistent://{tenant}/{namespace}/{topic-name}`

For KoP compatibility, topics are accessible via:
- **Kafka protocol**: `user-requests` (simple name)
- **Pulsar protocol**: `persistent://public/default/user-requests` (full name)

## Verifying Setup

### 1. Check Pulsar Health

```powershell
curl http://localhost:8080/admin/v2/brokers/health
```

Should return: `{"status":"ok"}`

### 2. List Topics (Pulsar Admin)

```powershell
docker exec pulsar-broker bin/pulsar-admin topics list public/default
```

### 3. Test Kafka Protocol (KoP)

Produce a test message using Kafka CLI:
```powershell
docker exec -it pulsar-broker kafka-console-producer --topic user-requests --bootstrap-server localhost:9092
```

Consume messages:
```powershell
docker exec -it pulsar-broker kafka-console-consumer --topic orchestrator-results --bootstrap-server localhost:9092 --from-beginning
```

### 4. Test Pulsar Native Protocol

```powershell
docker exec pulsar-broker bin/pulsar-client consume persistent://public/default/user-requests -s test-subscription
```

## Migration from Kafka

### Phase I: Bridge (Current)

1. Deploy Pulsar with KoP
2. Point `KAFKA_BROKERS` to Pulsar KoP endpoint (localhost:9092)
3. Set `USE_PULSAR_KOP=true`
4. Existing code works without changes!

### Phase II: Native Pulsar Client (Future)

- Replace `kafkajs` with `pulsar-client`
- Migrate to Pulsar Functions
- Use Pulsar Schema Registry

### Phase III: Multi-Tenancy (Future)

- Implement namespace-based routing
- Configure tiered storage
- Enable per-tenant isolation

## Troubleshooting

### "Connection refused" on port 9092

- Check if Pulsar broker is running: `docker ps | grep pulsar-broker`
- Verify KoP is enabled in broker logs: `docker logs pulsar-broker | grep kop`
- Check port mapping: `docker port pulsar-broker`

### "Topic not found"

- Run topic setup script: `.\scripts\setup-pulsar-topics.ps1`
- Verify namespace exists: `docker exec pulsar-broker bin/pulsar-admin namespaces list public`

### "Consumer group not working"

- KoP supports Kafka consumer groups
- Check consumer group status: `docker exec pulsar-broker bin/pulsar-admin topics subscriptions persistent://public/default/user-requests`

### Broker not starting

- Check Zookeeper is healthy: `docker logs pulsar-zookeeper`
- Check Bookie is ready: `docker logs pulsar-bookie`
- Increase memory allocation if needed (edit `docker-compose.pulsar.yml`)

## Performance Considerations

### Latency

- **Target**: Sub-50ms tool routing (maintain Kafka performance)
- **KoP Overhead**: ~5-10ms additional latency vs native Kafka
- **Benchmark**: Run latency tests before production

### Throughput

- Pulsar handles 10x+ current load with same infrastructure
- KoP throughput similar to Kafka for most use cases

### Storage

- BookKeeper (Pulsar storage) is more efficient than Kafka logs
- Tiered storage offloads old data to GCS/S3 (Phase III)

## Next Steps

1. ✅ **Phase I Complete**: KoP bridge deployed
2. 🔄 **Phase II**: Migrate to Pulsar Functions
3. 📋 **Phase III**: Multi-tenant isolation and tiered storage

See [KAFKA_ORCHESTRATOR.md](./KAFKA_ORCHESTRATOR.md) for orchestrator architecture details.

## Additional Resources

- [Apache Pulsar Documentation](https://pulsar.apache.org/docs/)
- [KoP (Kafka-on-Pulsar) Guide](https://github.com/streamnative/kop)
- [Pulsar Functions Documentation](https://pulsar.apache.org/docs/functions-overview/)
