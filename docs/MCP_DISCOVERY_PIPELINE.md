# MCP Server Discovery Pipeline

## Problem Statement

When MCP servers are registered/updated in the SlashMCP.com registry, orchestrator agents (like LangChain) need to be aware of:
1. **Available Tools**: What MCP servers are available
2. **Tool Capabilities**: What tools each server provides
3. **Tool Context**: How to use each tool (from tool context specification)
4. **Real-time Updates**: When servers are added, updated, or removed

## Current Gap

- **Registry** knows about all MCP servers
- **Orchestrators** (LangChain, homegrown agents) don't automatically discover new servers
- **Manual Configuration** required to add tools to orchestrators
- **Stale State** - orchestrators may not know about newly registered servers

## Proposed Architecture

### Option 1: Registry Webhook/Notification System (Recommended)

```
┌─────────────┐         ┌──────────────┐         ┌─────────────────┐
│   Registry  │────────▶│ Notification │────────▶│  Orchestrator   │
│             │  POST   │   Service    │  Webhook│  (LangChain)    │
│  MCP Added  │         │  (SQS/Kafka) │         │                 │
└─────────────┘         └──────────────┘         └─────────────────┘
                              │
                              │ Event Stream
                              ▼
                        ┌──────────────┐
                        │ Event Log    │
                        │ (Audit Trail)│
                        └──────────────┘
```

**Implementation:**
1. When MCP server is registered/updated → emit event
2. Notification service routes to registered orchestrators
3. Orchestrators receive webhook with server details
4. Orchestrator registers tools automatically

**Pros:**
- Real-time updates
- Decoupled architecture
- Scalable to multiple orchestrators

**Cons:**
- Requires notification infrastructure
- Orchestrators need webhook endpoints

### Option 2: Polling-Based Discovery

```
┌─────────────┐         ┌─────────────────┐
│   Registry  │◀────────│  Orchestrator   │
│             │  GET    │  (LangChain)    │
│  /v0.1/     │         │                 │
│  servers    │         │  (Poll every    │
│             │         │   5 minutes)    │
└─────────────┘         └─────────────────┘
```

**Implementation:**
1. Orchestrator polls `/v0.1/servers` periodically
2. Compares with known servers
3. Auto-registers new/updated servers
4. Deregisters removed servers

**Pros:**
- Simple to implement
- No external dependencies
- Works with existing API

**Cons:**
- Not real-time (polling delay)
- Increases load on registry
- Orchestrator must track state

### Option 3: Service Mesh / Service Discovery

```
┌─────────────┐         ┌──────────────┐         ┌─────────────────┐
│   Registry  │────────▶│ Service      │────────▶│  Orchestrator   │
│             │  Publish│  Discovery   │  Query  │  (LangChain)    │
│  MCP Added  │         │  (Consul/    │         │                 │
└─────────────┘         │   etcd)      │         └─────────────────┘
                        └──────────────┘
```

**Pros:**
- Industry-standard approach
- Built-in health checks
- Service mesh integration

**Cons:**
- Additional infrastructure
- More complex setup
- Overkill for current scale

## Recommended Implementation: Hybrid Approach

### Phase 1: Polling-Based (Quick Win)
Implement polling for immediate functionality:
- Orchestrator polls `/v0.1/servers` every 5 minutes
- Auto-discovers new servers
- Registers tools automatically

### Phase 2: Webhook System (Future)
Build event-driven system:
- Registry emits events on server changes
- Webhook service routes to orchestrators
- Real-time updates

## API Design

### Discovery Endpoint

**GET `/v0.1/servers?for_orchestrator=true`**

Returns servers optimized for orchestrator discovery:
- Full tool schemas
- Tool context metadata
- Server capabilities
- Health status

**Response Format:**
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
            "whenToUse": "Need live data from web pages"
          }
        }
      ],
      "metadata": {
        "httpHeaders": {...},
        "healthCheck": "healthy"
      }
    }
  ],
  "lastUpdated": "2024-12-25T22:00:00Z"
}
```

### Webhook Endpoint (Future)

**POST `/v0.1/webhooks/orchestrators`**

Register orchestrator to receive updates:
```json
{
  "orchestratorId": "langchain-agent",
  "webhookUrl": "https://langchain-agent.../mcp-updates",
  "filters": {
    "serverIds": ["*"], // All servers
    "capabilities": ["tools"]
  }
}
```

## Orchestrator Integration

### LangChain Agent Discovery

When LangChain agent starts:
1. Poll `/v0.1/servers?for_orchestrator=true`
2. Register each server's tools in LangChain
3. Map tool contexts for intelligent routing
4. Set up periodic refresh (every 5 minutes)

**Tool Registration Flow:**
```
1. Fetch servers from registry
2. For each server:
   - Create LangChain tool wrapper
   - Register tool with orchestrator
   - Map tool context metadata
3. Update tool routing logic
```

### Homegrown Agent Discovery

Similar flow but more customizable:
1. Poll registry endpoint
2. Filter servers by criteria
3. Register tools in agent's tool registry
4. Update routing matrix

## Implementation Steps

### Step 1: Enhanced Discovery Endpoint
- [ ] Create `/v0.1/servers?for_orchestrator=true`
- [ ] Include tool context in response
- [ ] Add health status
- [ ] Optimize response format

### Step 2: Orchestrator Client Library
- [ ] Create `@slashmcp/orchestrator-client` package
- [ ] Implement polling logic
- [ ] Auto-registration of tools
- [ ] Tool context mapping

### Step 3: LangChain Integration
- [ ] Create LangChain tool wrappers
- [ ] Register tools on discovery
- [ ] Update agent executor configuration
- [ ] Test multi-tool orchestration

### Step 4: Event System (Future)
- [ ] Implement event emitter in registry
- [ ] Create webhook service
- [ ] Add webhook registration endpoint
- [ ] Real-time tool updates

## Example: LangChain Tool Registration

```python
# orchestrator_client.py
from slashmcp import MCPRegistryClient

class LangChainMCPOrchestrator:
    def __init__(self, registry_url):
        self.registry = MCPRegistryClient(registry_url)
        self.tools = {}
        
    async def discover_tools(self):
        """Poll registry and register available tools"""
        servers = await self.registry.get_servers(for_orchestrator=True)
        
        for server in servers:
            for tool in server.tools:
                # Create LangChain tool wrapper
                langchain_tool = self.create_langchain_tool(server, tool)
                self.tools[tool.name] = langchain_tool
                
        return self.tools
    
    def create_langchain_tool(self, server, tool):
        """Convert MCP tool to LangChain tool"""
        from langchain.tools import Tool
        
        async def tool_func(**kwargs):
            result = await self.registry.invoke_tool(
                server.serverId,
                tool.name,
                kwargs
            )
            return result
            
        return Tool(
            name=f"{server.name}::{tool.name}",
            description=tool.description,
            func=tool_func,
            metadata={
                "toolContext": tool.toolContext,
                "serverId": server.serverId
            }
        )
```

## Benefits

1. **Automatic Discovery**: Orchestrators always know available tools
2. **Zero Configuration**: No manual tool registration needed
3. **Real-time Updates**: New servers immediately available
4. **Tool Context Awareness**: Orchestrators understand tool capabilities
5. **Scalable**: Works with multiple orchestrators

## Next Steps

1. **Design Review**: Review architecture with team
2. **Phase 1 Implementation**: Polling-based discovery
3. **LangChain Integration**: Test with LangChain agent
4. **Documentation**: Update orchestrator integration docs
5. **Phase 2 Planning**: Design webhook system

## Related Documents

- [Tool Context Specification](./TOOL_CONTEXT_SPECIFICATION.md)
- [LangChain Agent Spec](./LANGCHAIN_AGENT_SPEC.md)
- [API Documentation](./API.md)











