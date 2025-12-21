# Implementation Gap Analysis

## Overview
This document compares the documented architecture in `agentic-orchestration.md` with the current codebase implementation to identify gaps and next steps.

## ✅ What's Implemented

### 1. Memory System
- **Status**: ✅ Fully Implemented
- **Files**:
  - `backend/src/services/memory.service.ts` - Complete memory service
  - `backend/src/routes/memory.ts` - Memory API endpoints
- **Features**:
  - ✅ `upsertContext()` - Store tool outputs, conversation state, preferences, facts
  - ✅ `searchHistory()` - Search memories by query
  - ✅ `getMemories()` - Get memories for conversation/user
  - ✅ `storeMemory()` - Store individual memories
  - ✅ Memory types: preference, fact, context, instruction
  - ✅ Importance scoring and access tracking

### 2. Event Bus (Basic)
- **Status**: ✅ Partially Implemented
- **Files**:
  - `backend/src/services/event-bus.service.ts` - Event emission
  - `backend/src/services/event-bus-consumer.service.ts` - Event consumption
- **Features**:
  - ✅ `emit()` - Publish events to Kafka topics
  - ✅ Server-specific topics (`mcp.events.{serverId}`)
  - ✅ Global topic (`mcp.events.all`)
  - ✅ Pattern-based event handlers
  - ✅ Event consumer with handler registration

### 3. Event Emission in Tool Invocations
- **Status**: ✅ Implemented
- **File**: `backend/src/routes/v0/invoke.ts`
- **Features**:
  - ✅ Emits `tool.{toolName}.completed` events after successful tool calls
  - ✅ Includes `conversationId` and `correlationId` in events

### 4. Kafka Infrastructure
- **Status**: ✅ Fully Implemented
- **Files**:
  - `backend/src/config/kafka.ts` - Kafka client setup
  - `backend/src/services/kafka-producer.service.ts` - Event producer
  - `backend/src/services/kafka-consumer.service.ts` - Event consumer
- **Features**:
  - ✅ Design request/ready events (for SVG generation)
  - ✅ WebSocket push on completion

## ❌ What's Documented but NOT Implemented

### 1. Context ID vs Conversation ID
- **Documentation Says**: Use `context_id` as the key for linking registry state with memory snapshots
- **Reality**: Code uses `conversationId` instead
- **Gap**: Terminology mismatch - docs use `context_id`, code uses `conversationId`
- **Impact**: Low - just a naming difference, but should be standardized

### 2. Registry as State Machine
- **Documentation Says**: Registry entries should have state fields:
  - `lockedBy` - Which agent is currently processing
  - `state` - Current workflow state (e.g., `VisionAnalyzing` → `VisionCompleted` → `ResearcherQueued`)
  - `attempts` - Retry count
  - `context_id` - Link to memory snapshots
- **Reality**: `McpServer` model doesn't have these fields
- **Gap**: No workflow state tracking in registry
- **Impact**: High - Can't track orchestration progress or detect stalled workflows

### 3. Handover Schema Standardization
- **Documentation Says**: Standardize JSON payload for every Kafka event:
  ```json
  {
    "context_id": "...",
    "intent": "...",
    "last_tool_output": {...},
    "memory_snapshot_url": "...",
    "token_budget": 1000,
    "status": "..."
  }
  ```
- **Reality**: Events use ad-hoc payloads:
  ```json
  {
    "event": "tool.browser_take_screenshot.completed",
    "serverId": "...",
    "payload": {
      "tool": "...",
      "arguments": {...},
      "result": {...}
    },
    "conversationId": "...",
    "correlationId": "..."
  }
  ```
- **Gap**: No standardized handover schema
- **Impact**: Medium - Makes it harder for orchestrators to consume events

### 4. Memory Snapshot URLs
- **Documentation Says**: Events should include `memory_snapshot_url` so downstream consumers can hydrate prompts
- **Reality**: No memory snapshot URL generation or storage
- **Gap**: Can't reference specific memory states
- **Impact**: Medium - Orchestrators can't easily load context snapshots

### 5. DLQ / Healer Pattern
- **Documentation Says**: 
  - Failed events should go to DLQ topic (`mcp.events.dlq`)
  - Healer agent watches DLQ and performs compensating actions
  - Updates registry state to `PlanB` when recovery needed
- **Reality**: Only comments mention DLQ, no implementation
- **Gap**: No error recovery mechanism
- **Impact**: High - Failed orchestrations can't recover automatically

### 6. Vision → Researcher → Downstream Tools Workflow
- **Documentation Says**: Example workflow where:
  1. Vision MCP emits `vision.analysis.completed`
  2. Researcher Orchestrator consumes it, syncs memory, enriches reasoning
  3. Researcher emits events for downstream tools (Valuation, Playwright)
- **Reality**: No example workflow implementation
- **Gap**: No orchestration examples
- **Impact**: Medium - Hard to understand how to build workflows

### 7. UI Feedback for Orchestration
- **Documentation Says**: WebSocket/SSE should stream Kafka events so frontend shows "Agent thinking..." updates
- **Reality**: WebSocket exists for design jobs, but not for orchestration events
- **Gap**: No real-time orchestration feedback
- **Impact**: Medium - Users can't see orchestration progress

### 8. Token Budget Tracking
- **Documentation Says**: Events should include `token_budget` for downstream consumers
- **Reality**: No token budget tracking
- **Gap**: Can't manage token usage across orchestration
- **Impact**: Low - Nice to have, not critical

## 📋 Recommended Next Steps

### Priority 1: Critical Gaps

#### 1.1 Standardize Terminology
- **Action**: Decide on `context_id` vs `conversationId`
- **Recommendation**: Use `conversationId` (already in code) and update docs
- **Files to Update**: `docs/agentic-orchestration.md`

#### 1.2 Add Registry State Machine Fields
- **Action**: Add workflow state tracking to `McpServer` model
- **Steps**:
  1. Add fields to Prisma schema:
     ```prisma
     model McpServer {
       // ... existing fields ...
       workflowState    String?  // e.g., "VisionAnalyzing", "ResearcherQueued"
       lockedBy         String?  // Agent/server currently processing
       workflowAttempts Int      @default(0)
       contextId        String?  // Link to conversation/memory
     }
     ```
  2. Create migration
  3. Update registry service to manage state transitions
- **Files**: `backend/prisma/schema.prisma`, `backend/src/services/registry.service.ts`

#### 1.3 Implement DLQ / Healer Pattern
- **Action**: Add error recovery mechanism
- **Steps**:
  1. Create DLQ topic (`mcp.events.dlq`)
  2. Route failed events to DLQ
  3. Create Healer service that watches DLQ
  4. Implement recovery strategies (retry, alternate tools, Plan B)
- **Files**: 
  - `backend/src/services/healer.service.ts` (new)
  - `backend/src/services/event-bus.service.ts` (update)

### Priority 2: Important Enhancements

#### 2.1 Standardize Event Handover Schema
- **Action**: Create standard event payload format
- **Steps**:
  1. Define `HandoverEvent` interface
  2. Update `MCPEvent` to include standard fields
  3. Add helper functions to create handover events
- **Files**: 
  - `backend/src/types/mcp-events.ts` (new or update)
  - `backend/src/services/event-bus.service.ts` (update)

#### 2.2 Add Memory Snapshot URLs
- **Action**: Generate and store memory snapshot references
- **Steps**:
  1. Add `snapshotUrl` field to Memory model or create Snapshot model
  2. Generate snapshot on context updates
  3. Include snapshot URL in events
- **Files**: 
  - `backend/src/services/memory.service.ts` (update)
  - `backend/src/routes/memory.ts` (add snapshot endpoint)

#### 2.3 Create Example Orchestration Workflow
- **Action**: Implement Vision → Researcher workflow
- **Steps**:
  1. Create workflow service
  2. Register event handlers for `vision.analysis.completed`
  3. Implement Researcher orchestrator logic
  4. Emit downstream tool events
- **Files**: 
  - `backend/src/services/workflow-example.service.ts` (exists but empty)
  - `backend/src/services/researcher-orchestrator.service.ts` (new)

### Priority 3: Nice to Have

#### 3.1 UI Feedback for Orchestration
- **Action**: Stream orchestration events to frontend
- **Steps**:
  1. Extend WebSocket service to handle orchestration events
  2. Filter events for UI (status updates, progress)
  3. Update frontend to display orchestration steps
- **Files**: 
  - `backend/src/services/websocket.service.ts` (update)
  - `app/chat/page.tsx` (update)

#### 3.2 Token Budget Tracking
- **Action**: Track and include token budgets in events
- **Steps**:
  1. Add token budget calculation
  2. Include in event payloads
  3. Track usage across orchestration
- **Files**: 
  - `backend/src/services/token-budget.service.ts` (new)

## 🔧 Implementation Order

1. **Week 1**: Fix terminology, add registry state fields, implement DLQ
2. **Week 2**: Standardize event schema, add memory snapshots
3. **Week 3**: Create example workflow, add UI feedback
4. **Week 4**: Token budget tracking, polish

## 📝 Notes

- The codebase is in good shape - most foundational pieces exist
- Main gaps are in orchestration-specific features (state machine, DLQ, workflows)
- Documentation is slightly ahead of code, but not drastically
- Focus on making what exists work well before adding new features
