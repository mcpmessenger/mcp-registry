# Pulsar Schema Registry

This document describes how event schemas are mapped to Pulsar Schema Registry for type safety and schema evolution.

## Overview

Pulsar Schema Registry provides:
- **Type Safety**: Enforce message schemas at the broker level
- **Schema Evolution**: Support backward/forward compatible schema changes
- **Code Generation**: Generate type-safe clients from schemas

## Event Schemas

The orchestrator uses the following event types (defined in `backend/src/services/orchestrator/events.ts`):

### 1. UserRequestEvent

```typescript
{
  requestId: string
  normalizedQuery: string
  sessionId?: string
  contextSnapshot?: Record<string, unknown>
  metadata?: Record<string, unknown>
  timestamp: string
}
```

**Pulsar Schema (JSON)**:
```json
{
  "type": "record",
  "name": "UserRequestEvent",
  "namespace": "com.mcp.orchestrator.events",
  "fields": [
    {"name": "requestId", "type": "string"},
    {"name": "normalizedQuery", "type": "string"},
    {"name": "sessionId", "type": ["null", "string"], "default": null},
    {"name": "contextSnapshot", "type": ["null", {"type": "map", "values": "string"}], "default": null},
    {"name": "metadata", "type": ["null", {"type": "map", "values": "string"}], "default": null},
    {"name": "timestamp", "type": "string"}
  ]
}
```

### 2. ToolSignalEvent

```typescript
{
  requestId: string
  toolId: string
  serverId: string
  params?: Record<string, unknown>
  confidence: number
  status: 'TOOL_READY'
  attempt?: number
  maxAttempts?: number
  lastError?: string
  timestamp: string
}
```

**Pulsar Schema (JSON)**:
```json
{
  "type": "record",
  "name": "ToolSignalEvent",
  "namespace": "com.mcp.orchestrator.events",
  "fields": [
    {"name": "requestId", "type": "string"},
    {"name": "toolId", "type": "string"},
    {"name": "serverId", "type": "string"},
    {"name": "params", "type": ["null", {"type": "map", "values": "string"}], "default": null},
    {"name": "confidence", "type": "double"},
    {"name": "status", "type": {"type": "enum", "name": "ToolSignalStatus", "symbols": ["TOOL_READY"]}},
    {"name": "attempt", "type": ["null", "int"], "default": null},
    {"name": "maxAttempts", "type": ["null", "int"], "default": null},
    {"name": "lastError", "type": ["null", "string"], "default": null},
    {"name": "timestamp", "type": "string"}
  ]
}
```

### 3. OrchestratorPlanEvent

```typescript
{
  requestId: string
  plan: OrchestratorPlanStep[]
  requiresOrchestration?: boolean
  steps?: string[]
  confidence?: number
  metadata?: Record<string, unknown>
  timestamp: string
}
```

### 4. OrchestratorResultEvent

```typescript
{
  requestId: string
  status: 'tool' | 'plan' | 'failed'
  tool?: string
  toolPath?: string
  result?: InvokeToolResponse['result']
  plan?: OrchestratorPlanEvent
  error?: string
  timestamp: string
}
```

## Schema Registration

### Using Pulsar Admin CLI

```bash
# Register schema for user-requests topic
pulsar-admin schemas upload \
  persistent://public/default/user-requests \
  --filename user-request-schema.json

# Register schema for tool-signals topic
pulsar-admin schemas upload \
  persistent://public/default/tool-signals \
  --filename tool-signal-schema.json
```

### Using REST API

```bash
# Upload schema
curl -X POST \
  http://localhost:8080/admin/v2/schemas/public/default/user-requests/schema \
  -H "Content-Type: application/json" \
  -d @user-request-schema.json
```

### Using Pulsar Client (Node.js)

```typescript
import Pulsar from 'pulsar-client'

const client = new Pulsar.Client({
  serviceUrl: 'pulsar://localhost:6650'
})

// Producer with schema
const producer = await client.createProducer({
  topic: 'persistent://public/default/user-requests',
  schema: Pulsar.Schema.JSON({
    type: 'record',
    name: 'UserRequestEvent',
    // ... schema definition
  })
})
```

## Schema Evolution

Pulsar supports schema evolution with compatibility modes:

- **BACKWARD**: New schema can read data written with old schema
- **FORWARD**: Old schema can read data written with new schema
- **FULL**: Both backward and forward compatible
- **ALWAYS_COMPATIBLE**: No compatibility checks
- **NONE**: No schema evolution allowed

### Setting Compatibility Mode

```bash
pulsar-admin schemas set-schema-autoupdate-strategy \
  --compatibility BACKWARD \
  persistent://public/default/user-requests
```

## Code Generation

### Generate TypeScript Types from Schemas

```bash
# Install schema generator
npm install -g @apache/pulsar-client-nodejs

# Generate types
pulsar-schema-generate \
  --schema-file user-request-schema.json \
  --output-dir ./generated/types
```

## Implementation Status

**Phase II**: Schema registry integration
- [x] Schema definitions created
- [ ] Schemas registered in Pulsar
- [ ] Client code updated to use schemas
- [ ] Schema evolution strategy configured

## Migration Notes

For Phase I (KoP), schemas are not enforced since Kafka clients don't use Pulsar Schema Registry.

For Phase II (Native Pulsar), schemas are registered and enforced at the broker level.

## References

- [Pulsar Schema Documentation](https://pulsar.apache.org/docs/schema-get-started/)
- [Schema Evolution](https://pulsar.apache.org/docs/schema-evolution/)
- [JSON Schema Support](https://pulsar.apache.org/docs/schema-json/)
