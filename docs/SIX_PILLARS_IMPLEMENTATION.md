# Six Pillars of Orchestration - Implementation

This document describes the implementation of the Six Pillars of Orchestration architecture.

> 📊 **Visual Diagrams**: See [SIX_PILLARS_DIAGRAM.md](./SIX_PILLARS_DIAGRAM.md) for comprehensive Mermaid diagrams showing the architecture, data flow, and component interactions.

## Overview

The Six Pillars orchestration system provides a comprehensive, intelligent tool routing and execution framework that coordinates multiple services to fulfill user requests.

## The Six Pillars

### 1. Semantic Search Engine ✅

**Location**: `backend/src/services/orchestrator/semantic-search.service.ts`

**Purpose**: Manages vector representations for 'zero-shot' tool discovery.

**Features**:
- Generates embeddings for tools and queries (supports OpenAI API or keyword-based fallback)
- Performs vector similarity search using cosine similarity
- Hybrid ranking: semantic (70%) + keyword (20%) + usage (10%)
- Tracks tool usage statistics for improved matching

**Usage**:
```typescript
import { getSemanticSearchService } from './semantic-search.service'

const semanticSearch = getSemanticSearchService()
await semanticSearch.initialize()

const matches = await semanticSearch.search('when is the next concert', {
  limit: 5,
  minConfidence: 0.7,
})
```

### 2. Workflow Planner ✅

**Location**: `backend/src/services/orchestrator/unified-orchestrator.service.ts` (decomposeIntoSteps method)

**Purpose**: Breaks down multi-step goals into a task graph using patterns like ReAct.

**Features**:
- Detects multi-step queries (e.g., "once you have X, use Y")
- Decomposes complex queries into sequential steps
- Handles dependencies between steps
- Generates workflow plans with confidence scores

**Usage**: Integrated into Unified Orchestrator Service

### 3. Execution Engine ✅

**Location**: `backend/src/services/mcp-invoke.service.ts` (existing)

**Purpose**: Handles secure, protocol-compliant invocations of MCP servers (STDIO, HTTP, etc.).

**Features**:
- Supports both STDIO and HTTP MCP servers
- Protocol-compliant tool invocation
- Error handling and retry logic
- Latency tracking

**Usage**: Used by Unified Orchestrator Service for tool execution

### 4. Enhanced Tool Matcher ✅

**Location**: `backend/src/services/orchestrator/matcher.ts` (enhanced)

**Purpose**: Routes queries via a combination of vector similarity and the Kafka 'fast-path'.

**Features**:
- Fast keyword/regex pattern matching (fast-path)
- Enhanced semantic search integration (Pillar 1)
- Kafka-based event-driven matching
- High-confidence tool signal emission

**Usage**: Automatically processes user requests from Kafka `user-requests` topic

### 5. Context Manager ✅

**Location**: `lib/chat-context.ts` (existing) + Unified Orchestrator (context handling)

**Purpose**: The state engine that tracks variables, artifacts, and conversation history across tiers.

**Features**:
- Maintains conversation context
- Tracks workflow step results
- Manages variable dependencies
- Enhances parameters with context data

**Usage**: Integrated into Unified Orchestrator Service

### 6. Documentation Search (RAG) ✅

**Location**: `backend/src/services/orchestrator/documentation-search.service.ts`

**Purpose**: Uses RAG to help the orchestrator understand how to use complex tools.

**Features**:
- Extracts documentation from tool schemas
- Provides examples, usage patterns, and best practices
- Searches documentation for relevant context
- Enhances workflow steps with documentation insights

**Usage**:
```typescript
import { getDocumentationSearchService } from './documentation-search.service'

const docSearch = getDocumentationSearchService()
await docSearch.initialize()

const docs = await docSearch.search('how to use browser_navigate', 'browser_navigate', 'com.microsoft.playwright/mcp')
```

## Unified Orchestrator Service

**Location**: `backend/src/services/orchestrator/unified-orchestrator.service.ts`

**Purpose**: Coordinates all six pillars into a unified orchestration system.

**Features**:
- Plans workflows using Semantic Search + Workflow Planner
- Enhances steps with Documentation Search
- Executes workflows using Execution Engine
- Manages context throughout execution
- Tracks usage statistics for Semantic Search

**API Endpoints**:

1. **POST /api/orchestrator/unified/plan**
   - Plans a workflow from a query
   - Returns workflow plan with steps and confidence

2. **POST /api/orchestrator/unified/execute**
   - Executes a workflow plan
   - Returns execution results

3. **POST /api/orchestrator/unified/query**
   - Plans and executes in one call
   - Returns both plan and results

**Example Usage**:
```typescript
const orchestrator = getUnifiedOrchestrator()

// Plan workflow
const plan = await orchestrator.planWorkflow('when is the next iration concert in texas')

// Execute workflow
const result = await orchestrator.executeWorkflow(plan)
```

## Integration Points

### Semantic Search → Enhanced Tool Matcher
- Matcher uses Semantic Search Service for improved matching
- Falls back to legacy keyword matching if needed

### Documentation Search → Semantic Search
- Documentation Search can enhance Semantic Search results
- Provides context for better tool understanding

### Workflow Planner → Execution Engine
- Planner creates steps that Execution Engine executes
- Dependencies are handled automatically

### Context Manager → All Pillars
- Context is maintained across all workflow steps
- Results from one step feed into the next

## Configuration

### Environment Variables

```env
# Optional: For enhanced embeddings (uses keyword fallback if not set)
OPENAI_API_KEY=your_openai_key

# Required for Kafka-based matching
ENABLE_KAFKA=true
KAFKA_BROKERS=localhost:9092
```

### Initialization

All services are initialized automatically when first used. For explicit initialization:

```typescript
const orchestrator = getUnifiedOrchestrator()
await orchestrator.initialize()
```

## Performance Considerations

- **Semantic Search**: Uses keyword-based fallback if OpenAI API not available (still functional)
- **Embeddings**: Cached per tool, regenerated only when tools change
- **Documentation**: Extracted once per tool, cached in memory
- **Workflow Execution**: Steps execute sequentially (parallel execution can be added)

## Future Enhancements

1. **Vector Database**: Add PostgreSQL with pgvector for persistent embeddings
2. **Parallel Execution**: Execute independent steps in parallel
3. **Learning**: Improve matching based on success rates
4. **Documentation Sources**: Fetch documentation from external sources (GitHub, npm, etc.)
5. **Advanced RAG**: Use LLM to generate better documentation summaries

## Testing

Test the unified orchestrator:

```bash
# Plan a workflow
curl -X POST http://localhost:3001/api/orchestrator/unified/plan \
  -H "Content-Type: application/json" \
  -d '{"query": "when is the next iration concert in texas"}'

# Execute a query (plan + execute)
curl -X POST http://localhost:3001/api/orchestrator/unified/query \
  -H "Content-Type: application/json" \
  -d '{"query": "when is the next iration concert in texas"}'
```

## Status

✅ All six pillars implemented
✅ Unified orchestrator service created
✅ Integration with existing Kafka orchestrator
✅ API endpoints available
✅ Documentation complete

The Six Pillars orchestration system is now fully operational!
