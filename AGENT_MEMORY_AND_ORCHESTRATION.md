# Agent Memory and Cross-Server Orchestration

## Overview

For agents to work effectively across multiple MCP servers, we need:

1. **Memory System**: Store conversation history, user preferences, and context
2. **Cross-Server Orchestration**: Allow agents to use tools from multiple servers in a single workflow

## Current State

### ✅ What Works
- Single server tool invocation (`POST /v0.1/invoke`)
- Server discovery (`GET /v0.1/servers`)
- Multiple servers registered in registry

### ❌ What's Missing
- **No conversation persistence** - Chat history is lost on refresh
- **No cross-server workflows** - Can't chain tools from different servers
- **No memory** - Agents can't remember past interactions
- **No context sharing** - Each tool call is isolated

## Architecture

### 1. Memory System

**Database Models** (already added to Prisma schema):

- **Conversation**: Container for a chat session
- **Message**: Individual messages in a conversation
- **ToolInvocation**: Track tool calls across servers
- **Memory**: Long-term storage for user preferences and learned facts

**Memory Types**:
- `preference`: User preferences (e.g., "always use dark mode")
- `fact`: Learned facts (e.g., "user works at Google")
- `context`: Conversation context (e.g., "currently planning a trip to Paris")
- `instruction`: User instructions (e.g., "always explain technical terms")

### 2. Cross-Server Orchestration

**Agent Workflow Example**:

```
User: "Find restaurants near the Eiffel Tower and take a screenshot of the map"

Agent workflow:
1. Use Google Maps MCP → search_places("restaurants", location: "Eiffel Tower")
2. Get results from Maps
3. Use Playwright MCP → browser_navigate("maps.google.com/...")
4. Use Playwright MCP → browser_take_screenshot()
5. Return combined result to user
```

**Orchestration Service**:
- Receives high-level user request
- Breaks down into tool calls across multiple servers
- Manages execution order and dependencies
- Handles errors and retries
- Maintains context between tool calls

## Implementation Plan

### Phase 1: Memory System ✅ (Schema Added)

1. ✅ Add database models for conversations, messages, tool invocations, and memory
2. ⏳ Create conversation service
3. ⏳ Create memory service
4. ⏳ Add conversation API endpoints
5. ⏳ Update frontend to use persistent conversations

### Phase 2: Cross-Server Orchestration

1. ⏳ Create orchestration service
2. ⏳ Add workflow planning (break down user requests)
3. ⏳ Add tool execution coordinator
4. ⏳ Add context passing between tool calls
5. ⏳ Add error handling and retries

### Phase 3: Advanced Features

1. ⏳ Memory prioritization (forget less important memories)
2. ⏳ Context window management
3. ⏳ Multi-turn conversation handling
4. ⏳ User preference learning

## API Endpoints (To Be Added)

### Conversations

```
POST   /api/conversations              # Create new conversation
GET    /api/conversations              # List user's conversations
GET    /api/conversations/:id          # Get conversation with messages
PUT    /api/conversations/:id          # Update conversation (title, etc.)
DELETE /api/conversations/:id          # Delete conversation
```

### Messages

```
POST   /api/conversations/:id/messages # Add message to conversation
GET    /api/conversations/:id/messages # Get conversation messages
```

### Memory

```
POST   /api/memory                     # Store memory
GET    /api/memory                     # Query memories
PUT    /api/memory/:id                 # Update memory
DELETE /api/memory/:id                 # Delete memory
```

### Orchestration

```
POST   /api/orchestrate                # Execute multi-server workflow
GET    /api/orchestrate/:id/status     # Check workflow status
```

## Example: Cross-Server Workflow

```typescript
// User request
const request = {
  conversationId: "conv_123",
  userMessage: "Find coffee shops near Times Square and show me a map",
  context: {
    userId: "user_456",
    previousMessages: [...]
  }
}

// Orchestration service breaks it down:
const workflow = {
  steps: [
    {
      serverId: "com.google.maps/mcp",
      tool: "search_places",
      arguments: { query: "coffee shops", location: "Times Square" }
    },
    {
      serverId: "com.microsoft.playwright/mcp",
      tool: "browser_navigate",
      arguments: { url: "maps.google.com/..." }
    },
    {
      serverId: "com.microsoft.playwright/mcp",
      tool: "browser_take_screenshot",
      arguments: {}
    }
  ]
}

// Execute workflow
const result = await orchestrationService.execute(workflow, request.conversationId)
```

## Benefits

1. **Better User Experience**: Conversations persist, agents remember context
2. **More Powerful**: Agents can combine tools from multiple servers
3. **Smarter**: Agents learn user preferences over time
4. **More Reliable**: Context helps agents make better decisions

## Next Steps

1. Run Prisma migration to add new models
2. Implement conversation service
3. Implement memory service
4. Add API endpoints
5. Update frontend to use persistent conversations
6. Implement orchestration service

## Questions to Consider

1. **Memory Limits**: How much memory should we store per user?
2. **Memory Expiration**: Should memories expire? When?
3. **Privacy**: How to handle sensitive information in memory?
4. **Performance**: How to efficiently query relevant memories?
5. **Cost**: Memory storage costs - should we limit it?
