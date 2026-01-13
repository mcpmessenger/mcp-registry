# KoP (Kafka-on-Pulsar) Installation Guide

## Issue

The standard Apache Pulsar image (`apachepulsar/pulsar:3.2.0`) does not include the KoP protocol handler by default. You'll see this error:

```
No protocol handler is found for protocol `kafka`. Available protocols are : {}
```

## Solutions

### Option 1: Use StreamNative Image (Recommended for Testing)

The StreamNative image includes KoP pre-installed:

```yaml
broker:
  image: streamnative/pulsar-all:3.2.0
```

Update `docker-compose.pulsar.yml` to use this image.

### Option 2: Manual KoP Installation

If using the standard Apache Pulsar image, you need to install KoP manually:

1. **Download KoP NAR file**:
   ```bash
   # For Pulsar 3.2.0, download KoP 3.2.0
   wget https://github.com/streamnative/kop/releases/download/v3.2.0/pulsar-protocol-handler-kafka-3.2.0.nar
   ```

2. **Copy to protocols directory**:
   ```bash
   docker exec pulsar-broker mkdir -p /pulsar/protocols
   docker cp pulsar-protocol-handler-kafka-3.2.0.nar pulsar-broker:/pulsar/protocols/
   ```

3. **Restart broker**:
   ```bash
   docker restart pulsar-broker
   ```

### Option 3: Build Custom Image

Create a Dockerfile that includes KoP:

```dockerfile
FROM apachepulsar/pulsar:3.2.0

# Download and install KoP
RUN mkdir -p /pulsar/protocols && \
    wget -O /pulsar/protocols/pulsar-protocol-handler-kafka-3.2.0.nar \
    https://github.com/streamnative/kop/releases/download/v3.2.0/pulsar-protocol-handler-kafka-3.2.0.nar
```

Build and use:
```bash
docker build -t pulsar-with-kop:3.2.0 .
# Update docker-compose.pulsar.yml to use: image: pulsar-with-kop:3.2.0
```

### Option 4: Test Without KoP First

For Phase I testing, you can test native Pulsar first (without KoP):

1. Remove KoP configuration from `docker-compose.pulsar.yml`:
   ```yaml
   # Comment out or remove these lines:
   # - PULSAR_PREFIX_messagingProtocols=kafka
   # - PULSAR_PREFIX_kopListeners=...
   ```

2. Use native Pulsar client (Phase II) instead of Kafka client
3. Set `ENABLE_PULSAR=true` (not `USE_PULSAR_KOP=true`)

## Verification

After installing KoP, verify it's working:

```bash
# Check broker logs for KoP initialization
docker logs pulsar-broker | grep -i kop

# Should see:
# "Successfully loaded protocol handler: kafka"
```

## References

- [KoP GitHub Repository](https://github.com/streamnative/kop)
- [KoP Installation Guide](https://github.com/streamnative/kop/blob/master/docs/installation.md)
- [StreamNative Pulsar Images](https://hub.docker.com/r/streamnative/pulsar-all)
