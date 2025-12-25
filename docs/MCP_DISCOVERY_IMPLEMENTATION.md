# MCP Discovery Pipeline - Implementation Status

## ✅ Phase 1: Polling-Based Discovery (COMPLETE)

### 1. Enhanced Discovery Endpoint

**Endpoint**: `GET /v0.1/servers?for_orchestrator=true`

Returns servers with enhanced metadata including:
- Tool context (core responsibility, output context)
- Health status
- Tool-level context metadata
- Timestamp of last update

**Example Request**:
```bash
curl "http://localhost:3001/v0.1/servers?for_orchestrator=true"
```

**Example Response**:
```json
{
  "servers": [
    {
      "serverId": "com.microsoft.playwright/mcp",
      "name": "Playwright MCP Server",
      "endpoint": "https://playwright-mcp...",
      "tools": [
        {
          "name": "browser_navigate",
          "description": "Navigate to a URL",
          "inputSchema": {...},
          "toolContext": {
            "coreResponsibility": "Real-time Extraction",
            "outputContext": "Live Prices, Hidden Rules, Contact Details",
            "description": "Extracts live data from web pages...",
            "useCases": ["Price monitoring", "Contact information gathering"],
            "whenToUse": "Price monitoring"
          }
        }
      ],
      "toolContext": {
        "coreResponsibility": "Real-time Extraction",
        "outputContext": "Live Prices, Hidden Rules, Contact Details"
      },
      "metadata": {
        "healthStatus": "healthy",
        "lastChecked": "2024-12-25T22:00:00Z"
      }
    }
  ],
  "lastUpdated": "2024-12-25T22:00:00Z",
  "totalServers": 4
}
```

### 2. Discovery Service

**File**: `backend/src/services/mcp-discovery.service.ts`

Provides:
- `getServersForOrchestrator()` - Enhanced server list with tool context
- `createDiscoveryEvent()` - Creates discovery events
- `emitDiscoveryEvent()` - Emits events (Kafka or console log)

### 3. Event Emission on Server Changes

Events are automatically emitted when:
- ✅ Server is registered (`server.registered`)
- ✅ Server is updated (`server.updated`)
- ✅ Server is removed (`server.removed`)

**Event Format**:
```json
{
  "eventType": "server.registered",
  "serverId": "com.microsoft.playwright/mcp",
  "server": { /* full server object */ },
  "timestamp": "2024-12-25T22:00:00Z",
  "metadata": {
    "toolContext": {
      "coreResponsibility": "Real-time Extraction",
      "outputContext": "Live Prices, Hidden Rules, Contact Details"
    }
  }
}
```

## ✅ Phase 2: Kafka Event Streaming (INFRASTRUCTURE READY)

### Kafka Producer

**File**: `backend/src/services/mcp-discovery.service.ts`

The Kafka producer is initialized automatically if:
- `KAFKA_BROKERS` environment variable is set, OR
- `ENABLE_KAFKA=true` environment variable is set

**Kafka Topic**: `mcp-server-events`

**Configuration**:
```env
KAFKA_BROKERS=localhost:9092,localhost:9093
# OR
ENABLE_KAFKA=true
```

**Note**: The system works **without Kafka**. Events are logged to console if Kafka is not available.

## 🧪 Testing

### 1. Test Discovery Endpoint

```bash
# Standard endpoint (frontend format)
curl "http://localhost:3001/v0.1/servers"

# Orchestrator endpoint (enhanced format)
curl "http://localhost:3001/v0.1/servers?for_orchestrator=true"
```

### 2. Test Event Emission

1. Register a new MCP server via the registry
2. Check backend logs for: `[MCP Discovery] Event: server.registered - <serverId>`
3. If Kafka is configured, check Kafka topic `mcp-server-events`

### 3. Verify Tool Context

Check that servers with known tool contexts return enhanced metadata:
- `com.google/maps-mcp` → Google Maps context
- `com.microsoft.playwright/mcp` → Playwright context
- `com.langchain/agent-mcp-server` → LangChain context

## 📋 Next Steps for Orchestrator Integration

### For LangChain Agent:

1. **Poll Discovery Endpoint**:
   ```python
   import requests
   import time
   
   def discover_mcp_servers():
       response = requests.get(
           "http://registry:3001/v0.1/servers?for_orchestrator=true"
       )
       return response.json()["servers"]
   
   # Poll every 5 minutes
   while True:
       servers = discover_mcp_servers()
       register_tools(servers)
       time.sleep(300)
   ```

2. **Register Tools**:
   ```python
   from langchain.tools import Tool
   
   def register_tools(servers):
       for server in servers:
           for tool in server["tools"]:
               langchain_tool = Tool(
                   name=f"{server['name']}::{tool['name']}",
                   description=tool["description"],
                   func=create_tool_func(server, tool),
                   metadata={
                       "toolContext": tool.get("toolContext"),
                       "serverId": server["serverId"]
                   }
               )
               agent.tools.append(langchain_tool)
   ```

### For Kafka Consumer (Future):

```typescript
import { Kafka } from 'kafkajs'

const kafka = new Kafka({
  clientId: 'langchain-orchestrator',
  brokers: ['localhost:9092']
})

const consumer = kafka.consumer({ groupId: 'langchain-agents' })

await consumer.subscribe({ topic: 'mcp-server-events' })

await consumer.run({
  eachMessage: async ({ message }) => {
    const event = JSON.parse(message.value.toString())
    if (event.eventType === 'server.registered') {
      await registerTool(event.server)
    }
  },
})
```

## 🔄 Integration with Existing System

The discovery pipeline integrates seamlessly:

1. **Registry Service** → Emits events on changes
2. **Discovery Service** → Provides enhanced endpoints
3. **Orchestrators** → Poll endpoint or subscribe to Kafka
4. **Frontend** → Uses standard endpoint (unchanged)

## 📊 Architecture Diagram

```
┌─────────────┐
│   Registry  │
│   Service   │
└──────┬──────┘
       │
       │ (on register/update/delete)
       ▼
┌──────────────┐
│   Discovery  │
│   Service    │
└──────┬───────┘
       │
       ├─────────────┬──────────────┐
       │             │              │
       ▼             ▼              ▼
  ┌────────┐   ┌─────────┐   ┌──────────┐
  │ Kafka  │   │ Console │   │ API Endp │
  │ (opt)  │   │  Log    │   │  /v0.1/  │
  └────┬───┘   └─────────┘   └────┬─────┘
       │                          │
       │                          │ (poll)
       │                          ▼
       │                    ┌──────────┐
       │                    │ LangChain│
       │                    │ Agent    │
       │                    └──────────┘
       │
       └─────────────────────────┘
              (Kafka consumer)
```

## ✅ Status Summary

- [x] Enhanced discovery endpoint with tool context
- [x] Event emission on server changes
- [x] Kafka producer infrastructure (optional)
- [x] Integration with registry service
- [ ] Orchestrator client library (next step)
- [ ] LangChain integration (next step)
- [ ] Kafka consumer example (future)

## 🎯 Benefits Achieved

1. **Zero Configuration**: Orchestrators auto-discover new servers
2. **Tool Context Aware**: Orchestrators understand tool capabilities
3. **Real-time Updates**: Events notify orchestrators immediately
4. **Backward Compatible**: Frontend uses standard endpoint
5. **Scalable**: Works with multiple orchestrators

