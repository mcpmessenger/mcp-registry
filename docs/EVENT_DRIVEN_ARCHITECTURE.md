# Event-Driven Architecture

Complete guide to the event-driven architecture using Apache Kafka.

## Overview

The MCP Registry backend uses an **Event-Driven Architecture (EDA)** with Apache Kafka to decouple heavy operations (AI generation) from API responses. This ensures:

- ✅ Frontend remains responsive (no timeouts)
- ✅ Heavy operations happen asynchronously
- ✅ Multiple workers can process requests in parallel
- ✅ System is horizontally scalable

## Architecture Components

### 1. Kafka Infrastructure

**Location**: `backend/src/config/kafka.ts`

- **Kafka Client**: Central Kafka instance
- **Kafka Producer**: Publishes events to topics
- **Kafka Consumer**: Consumes events from topics

### 2. Event Types

**Location**: `backend/src/types/kafka-events.ts`

- `DESIGN_REQUEST_RECEIVED`: Published when API receives design request
- `DESIGN_READY`: Published when design generation completes
- `DESIGN_FAILED`: Published when design generation fails

### 3. Event Flow

```
1. Frontend → POST /api/mcp/tools/generate
   ↓
2. API Gateway creates job → Publishes DESIGN_REQUEST_RECEIVED
   ↓
3. Worker consumes event → Processes design
   ↓
4. Worker publishes DESIGN_READY event
   ↓
5. API Gateway consumer receives event → Updates job → WebSocket push
```

## Kafka Topics

- **design-requests**: Design request events (API Gateway → Workers)
- **design-ready**: Design completion events (Workers → API Gateway)

## Setup

### Local Development (Docker)

```bash
# Start Kafka using Docker Compose
docker compose -f docker-compose.kafka.yml up -d

# Verify Kafka is running
docker ps | grep kafka
```

### Production (Confluent Cloud)

1. Sign up at [Confluent Cloud](https://www.confluent.io/confluent-cloud/)
2. Create cluster in same region as Cloud Run
3. Get broker endpoints
4. Update Cloud Run environment:
   ```bash
   gcloud run services update mcp-registry-backend \
     --update-env-vars "KAFKA_BROKERS=pkc-xxxxx.us-central1.gcp.confluent.cloud:9092"
   ```

## Configuration

**Environment Variables**:
```env
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=mcp-registry-api-gateway
KAFKA_GROUP_ID=mcp-registry-workers
KAFKA_TOPIC_DESIGN_REQUESTS=design-requests
KAFKA_TOPIC_DESIGN_READY=design-ready
```

## Testing

1. Start Kafka
2. Start backend server
3. Send POST request to `/api/mcp/tools/generate`
4. Check Kafka topics for events
5. Frontend receives updates via WebSocket

## Benefits

1. **Responsive Frontend**: No blocking operations
2. **Scalability**: Multiple workers in parallel
3. **Reliability**: Events persisted, retry capability
4. **Decoupling**: API Gateway and Workers independent
5. **Real-time Updates**: WebSocket notifications

## Troubleshooting

- **Connection errors**: Verify Kafka is running and accessible
- **Events not consumed**: Check consumer group IDs and topic names
- **No WebSocket updates**: Verify DESIGN_READY consumer is running

## Related Documentation

- [Kafka Setup Guide](./KAFKA_SETUP.md) - Detailed Kafka setup instructions
- [Architecture Documentation](./ARCHITECTURE.md) - Overall system architecture
- [Development Guide](./DEVELOPMENT.md) - Development workflow
















