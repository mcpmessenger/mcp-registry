# Event-Driven Architecture (EDA) Implementation

This document describes the Event-Driven Architecture implementation using Apache Kafka for the MCP Registry backend.

## Overview

The backend has been transformed from a synchronous HTTP-based architecture to an **Event-Driven Architecture (EDA)** using Apache Kafka as the "central nervous system." This ensures that:

- The frontend remains responsive (no timeouts or UI freezes)
- Heavy lifting (SVG generation, vision analysis) happens asynchronously
- Multiple workers can process requests in parallel
- The system is horizontally scalable

## Architecture Components

### 1. Kafka Infrastructure

**Location**: `src/config/kafka.ts`

- **Kafka Client**: Central Kafka instance
- **Kafka Producer**: Publishes events to topics
- **Kafka Consumer**: Consumes events from topics

### 2. Event Types

**Location**: `src/types/kafka-events.ts`

- `DESIGN_REQUEST_RECEIVED`: Published when API Gateway receives a design request
- `DESIGN_READY`: Published when design generation completes successfully
- `DESIGN_FAILED`: Published when design generation fails

### 3. Event Producers

**Location**: `src/services/kafka-producer.service.ts`

The Kafka Producer Service publishes events to Kafka topics:

- `publishDesignRequestReceived()`: Publishes design request events
- `publishDesignReady()`: Publishes completion events
- `publishDesignFailed()`: Publishes failure events

### 4. Event Consumers

#### Design Request Consumer (Multimodal Worker)

**Location**: `src/services/design-request-consumer.service.ts`

- Consumes `DESIGN_REQUEST_RECEIVED` events from the `design-requests` topic
- Processes design requests using the Multimodal Worker Service
- Publishes `DESIGN_READY` or `DESIGN_FAILED` events when complete

#### Design Ready Consumer (API Gateway)

**Location**: `src/services/kafka-consumer.service.ts`

- Consumes `DESIGN_READY` and `DESIGN_FAILED` events from the `design-ready` topic
- Updates job status in the database
- Triggers WebSocket push to frontend

### 5. Multimodal Worker Service

**Location**: `src/services/multimodal-worker.service.ts`

Processes design requests asynchronously:

1. Updates job status to PROCESSING
2. Calls Google Gemini API to generate SVG
3. Stores asset in database
4. Publishes `DESIGN_READY` event to Kafka

## Event Flow

### Design Generation Round-Trip

```
1. Frontend → API Gateway (POST /api/mcp/tools/generate)
   ↓
2. API Gateway creates job and publishes DESIGN_REQUEST_RECEIVED event
   ↓
3. Multimodal Worker consumes event and processes design
   ↓
4. Worker publishes DESIGN_READY event
   ↓
5. API Gateway consumer receives DESIGN_READY event
   ↓
6. API Gateway updates job status and pushes to frontend via WebSocket
```

### Kafka Topics

- **design-requests**: Design request events (produced by API Gateway, consumed by Workers)
- **design-ready**: Design completion events (produced by Workers, consumed by API Gateway)

## Configuration

### Environment Variables

```env
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=mcp-registry-api-gateway
KAFKA_GROUP_ID=mcp-registry-workers
KAFKA_TOPIC_DESIGN_REQUESTS=design-requests
KAFKA_TOPIC_DESIGN_READY=design-ready
```

### Setting Up Kafka Locally

1. **Install Kafka** (if not already installed):
   ```bash
   # Using Docker
   docker run -p 9092:9092 apache/kafka:latest
   ```

2. **Or use Kafka locally**:
   - Download from https://kafka.apache.org/downloads
   - Start Zookeeper: `bin/zookeeper-server-start.sh config/zookeeper.properties`
   - Start Kafka: `bin/kafka-server-start.sh config/server.properties`

3. **Create topics**:
   ```bash
   kafka-topics.sh --create --topic design-requests --bootstrap-server localhost:9092
   kafka-topics.sh --create --topic design-ready --bootstrap-server localhost:9092
   ```

## Benefits

1. **Responsive Frontend**: No blocking operations, UI stays responsive
2. **Scalability**: Multiple workers can process requests in parallel
3. **Reliability**: Events are persisted, workers can retry failed jobs
4. **Decoupling**: API Gateway and Workers are completely decoupled
5. **Real-time Updates**: Frontend receives updates via WebSocket asynchronously

## Next Steps

### For Production

1. **Kafka Cluster**: Set up a multi-broker Kafka cluster
2. **Monitoring**: Add Kafka monitoring (e.g., Kafka Manager, Prometheus)
3. **Error Handling**: Implement dead-letter queues for failed events
4. **Rate Limiting**: Add rate limiting per user/client
5. **OAuth Integration**: Wire OAuth 2.1 service to validate client permissions

### For Go Services

The architecture is designed to support polyglot services:

- **Go-based API Gateway**: High-throughput request handling
- **Go-based Registry Service**: Fast server discovery
- **Python/FastAPI Workers**: LLM orchestration (already using Node.js with Gemini SDK)

You can replace Node.js consumers with Go services that consume the same Kafka topics.

## Testing

To test the event-driven flow:

1. Start Kafka
2. Start the backend server
3. Send a POST request to `/api/mcp/tools/generate`
4. Check Kafka topics to see events flowing
5. Frontend should receive updates via WebSocket

## Troubleshooting

- **Kafka connection errors**: Ensure Kafka is running and accessible at the configured broker address
- **Events not consumed**: Check consumer group IDs and topic names match
- **No WebSocket updates**: Verify the DESIGN_READY consumer is running and processing events
