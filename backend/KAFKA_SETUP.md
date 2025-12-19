# Kafka Setup Guide

This guide helps you set up Apache Kafka for the MCP Registry Event-Driven Architecture.

## Quick Start with Docker

The easiest way to run Kafka locally is using Docker:

```bash
# Start Zookeeper and Kafka using Docker Compose
docker-compose up -d

# Or use a single Kafka container
docker run -d \
  --name kafka \
  -p 9092:9092 \
  -e KAFKA_ZOOKEEPER_CONNECT=localhost:2181 \
  apache/kafka:latest
```

## Manual Installation

### 1. Download Kafka

```bash
# Download Kafka (adjust version as needed)
wget https://downloads.apache.org/kafka/3.7.0/kafka_2.13-3.7.0.tgz
tar -xzf kafka_2.13-3.7.0.tgz
cd kafka_2.13-3.7.0
```

### 2. Start Zookeeper

```bash
bin/zookeeper-server-start.sh config/zookeeper.properties
```

### 3. Start Kafka

In a new terminal:

```bash
bin/kafka-server-start.sh config/server.properties
```

### 4. Create Topics

In another terminal:

```bash
# Create design-requests topic
bin/kafka-topics.sh --create \
  --topic design-requests \
  --bootstrap-server localhost:9092 \
  --partitions 3 \
  --replication-factor 1

# Create design-ready topic
bin/kafka-topics.sh --create \
  --topic design-ready \
  --bootstrap-server localhost:9092 \
  --partitions 3 \
  --replication-factor 1

# Verify topics were created
bin/kafka-topics.sh --list --bootstrap-server localhost:9092
```

## Windows Setup

### Using Docker Desktop

1. Install Docker Desktop for Windows
2. Run:
   ```powershell
   docker run -d --name zookeeper -p 2181:2181 zookeeper:latest
   docker run -d --name kafka -p 9092:9092 -e KAFKA_ZOOKEEPER_CONNECT=localhost:2181 apache/kafka:latest
   ```

### Using WSL2

1. Install WSL2 and Ubuntu
2. Follow Linux instructions above within WSL2
3. Kafka will be accessible from Windows at `localhost:9092`

## Verify Kafka is Running

### Check if Kafka is accessible

```bash
# List topics
kafka-topics.sh --list --bootstrap-server localhost:9092

# Should output:
# design-ready
# design-requests
```

### Test producer/consumer

```bash
# Terminal 1: Start consumer
kafka-console-consumer.sh --topic design-requests --bootstrap-server localhost:9092

# Terminal 2: Start producer
kafka-console-producer.sh --topic design-requests --bootstrap-server localhost:9092

# Type a message in Terminal 2, it should appear in Terminal 1
```

## Configuration

Update your `.env` file:

```env
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=mcp-registry-api-gateway
KAFKA_GROUP_ID=mcp-registry-workers
KAFKA_TOPIC_DESIGN_REQUESTS=design-requests
KAFKA_TOPIC_DESIGN_READY=design-ready
```

## Troubleshooting

### Kafka connection refused

- Ensure Kafka is running: `docker ps` or check process
- Verify port 9092 is not blocked by firewall
- Check KAFKA_BROKERS in .env matches your Kafka setup

### Topics not found

- Create topics manually (see step 4 above)
- Check topic names match your .env configuration

### Consumer not receiving messages

- Verify consumer group ID is correct
- Check if messages are being produced (use console consumer)
- Ensure topics exist and have messages

## Production Considerations

For production deployments:

1. **Multi-broker cluster**: Set up 3+ Kafka brokers for redundancy
2. **Replication factor**: Use replication-factor of 3 for production topics
3. **Partitions**: Adjust partitions based on expected throughput
4. **Monitoring**: Set up Kafka monitoring (JMX, Prometheus, Grafana)
5. **Security**: Enable SASL/SSL for production clusters
6. **Retention**: Configure appropriate message retention policies

## Docker Compose Example

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"

  kafka:
    image: confluentinc/cp-kafka:latest
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
```

Run: `docker-compose up -d`
