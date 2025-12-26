# Natural Language Response Parser Specification

**Date**: December 26, 2024  
**Status**: 📋 Proposal  
**Goal**: Transform unstructured tool responses into natural language answers

---

## Problem Statement

### Current State

When tools like Playwright return responses, we get:
- **Raw YAML snapshots** from accessibility trees
- **Unstructured JSON** from APIs
- **Technical data dumps** that users can't easily understand

**Example Playwright Response**:
```yaml
- heading "Search Results" [ref=e1]
- list [ref=e2]:
  - listitem [ref=e3]: Iration - Thu, May 15 • 8:00 PM - Wells Fargo Arena
  - listitem [ref=e4]: Iration - Sat, Jun 20 • 7:00 PM - Orpheum Theater
```

**User sees**: Raw YAML dump  
**User wants**: "I found 2 Iration concerts in Iowa: one on May 15th at Wells Fargo Arena, and another on June 20th at Orpheum Theater."

---

## Solution: Smart Response Parser

Add a layer that:
1. ✅ Takes unstructured tool response
2. ✅ Understands the original user question
3. ✅ Extracts relevant information
4. ✅ Formats answer in natural language

---

## Architecture Options

### Option 1: Orchestrator-Level Parser (Recommended) ⭐

**Where**: Native Orchestrator or LangChain Orchestrator  
**When**: After tool execution, before returning to user

**Pros**:
- ✅ Orchestrator has full context (original query + tool results)
- ✅ Can synthesize across multiple tools
- ✅ Centralized logic
- ✅ Natural fit for orchestrators (they orchestrate AND synthesize)

**Cons**:
- ⚠️ Requires LLM call (cost/latency)
- ⚠️ Orchestrator becomes more complex

**Implementation**:
```typescript
// In native orchestrator or workflow executor
const toolResult = await invokeTool(...)
const naturalLanguageAnswer = await formatResponse(
  originalQuery: string,
  toolResult: any,
  toolContext: ToolContext
)
```

---

### Option 2: Client-Side Parser

**Where**: SlashMCP.com frontend (`app/chat/page.tsx`)  
**When**: After receiving tool response, before displaying

**Pros**:
- ✅ Keeps orchestrators simple
- ✅ Client controls formatting
- ✅ Can use different LLM models per user preference
- ✅ Can cache formatted responses

**Cons**:
- ⚠️ Requires LLM API key in frontend (security concern)
- ⚠️ Adds latency to client experience
- ⚠️ Loses context from orchestrator's workflow understanding

**Implementation**:
```typescript
// In app/chat/page.tsx
const rawResult = await invokeMCPTool(...)
const formattedResponse = await formatWithLLM(
  userQuery: string,
  rawResult: string,
  toolName: string
)
```

---

### Option 3: Tool-Level Parser

**Where**: Individual tools (e.g., Playwright MCP)  
**When**: Before returning response

**Pros**:
- ✅ Tool-specific formatting
- ✅ No additional orchestrator complexity

**Cons**:
- ⚠️ Each tool needs its own parser
- ⚠️ Tools don't know the user's question
- ⚠️ Can't synthesize across multiple tools

**Implementation**:
```typescript
// In Playwright MCP server
const snapshot = await page.snapshot()
const summary = await summarizeSnapshot(snapshot, optionalQuery)
return { snapshot, summary } // Return both
```

---

### Option 4: Hybrid Approach (Best of Both Worlds) 🎯

**Recommendation**: Combine Option 1 + Option 3

1. **Tools** provide structured data + optional summaries
2. **Orchestrator** synthesizes multiple tool results into natural language

**Implementation**:
- Playwright MCP: Returns snapshot + structured data extraction (dates, venues, prices)
- Native Orchestrator: Takes structured data + user query → natural language answer

---

## Recommended Architecture: Orchestrator-Level Parser

### Why Orchestrator?

1. **Context Awareness**: Orchestrator knows the full user intent
2. **Multi-Tool Synthesis**: Can combine data from multiple sources
3. **Query Understanding**: Already parses user queries for routing
4. **Natural Fit**: Orchestrators are designed to synthesize information

### Implementation Strategy

#### Phase 1: Native Orchestrator Enhancement

```typescript
// lib/native-orchestrator.ts or lib/workflow-executor.ts

interface ResponseFormatter {
  format(
    query: string,
    toolResult: unknown,
    toolContext: ToolContext
  ): Promise<string>
}

class NaturalLanguageFormatter implements ResponseFormatter {
  async format(
    query: string,
    toolResult: unknown,
    toolContext: ToolContext
  ): Promise<string> {
    // 1. Extract structured data from tool result
    const structuredData = this.extractData(toolResult, toolContext)
    
    // 2. Use LLM to format as natural language
    const naturalLanguage = await this.formatWithLLM(query, structuredData)
    
    return naturalLanguage
  }
  
  private extractData(result: unknown, context: ToolContext): StructuredData {
    // Parse YAML snapshots, JSON, etc. based on tool type
    if (context.tool === 'playwright') {
      return this.parsePlaywrightSnapshot(result)
    } else if (context.tool === 'google-maps') {
      return this.parseMapsResponse(result)
    }
    // ...
  }
  
  private async formatWithLLM(
    query: string,
    data: StructuredData
  ): Promise<string> {
    // Call LLM API (Gemini, OpenAI, etc.)
    // Prompt: "Given this user query: {query} and this data: {data}, 
    //          provide a natural language answer."
  }
}
```

#### Phase 2: Integration Points

**In `lib/workflow-executor.ts`**:
```typescript
export async function executeWorkflow(
  query: string,
  plan: WorkflowPlan
): Promise<WorkflowResult> {
  // ... execute steps ...
  
  // After all steps complete, format the final result
  const formatter = new NaturalLanguageFormatter()
  const naturalLanguageResult = await formatter.format(
    query,
    finalResult,
    toolContext
  )
  
  return {
    success: true,
    finalResult: naturalLanguageResult, // Natural language instead of raw data
    steps: executedSteps,
  }
}
```

**In `app/chat/page.tsx`**:
```typescript
// When displaying native orchestrator results
if (agentName === "Native Orchestrator") {
  // Result is already formatted in natural language
  responseContent = workflowResult.finalResult
}
```

---

## Example: Playwright Response Transformation

### Before (Raw Response)
```yaml
- heading "Search Results" [ref=e1]
- list [ref=e2]:
  - listitem [ref=e3]: Iration - Thu, May 15 • 8:00 PM - Wells Fargo Arena
  - listitem [ref=e4]: Iration - Sat, Jun 20 • 7:00 PM - Orpheum Theater
```

### After (Natural Language)
```
I found 2 Iration concerts in Iowa:

1. **May 15, 2025 at 8:00 PM**
   - Venue: Wells Fargo Arena
   - Get tickets: [link]

2. **June 20, 2025 at 7:00 PM**
   - Venue: Orpheum Theater
   - Get tickets: [link]
```

---

## Implementation Checklist

### Phase 1: Data Extraction
- [ ] Create `ResponseParser` interface
- [ ] Implement `PlaywrightSnapshotParser` (extract concerts, dates, venues)
- [ ] Implement `GoogleMapsParser` (extract locations, addresses, coordinates)
- [ ] Implement `SearchParser` (extract articles, summaries)

### Phase 2: Natural Language Formatting
- [ ] Create `NaturalLanguageFormatter` class
- [ ] Integrate LLM API (Gemini, OpenAI, or Claude)
- [ ] Create formatting prompts for each tool type
- [ ] Add caching for repeated queries

### Phase 3: Orchestrator Integration
- [ ] Add formatter to `NativeOrchestrator`
- [ ] Update `WorkflowExecutor` to use formatter
- [ ] Add formatter to `LangChainOrchestrator` (if applicable)
- [ ] Handle formatting errors gracefully

### Phase 4: Testing & Optimization
- [ ] Test with various query types
- [ ] Optimize prompt engineering
- [ ] Add response caching
- [ ] Monitor LLM API costs

---

## LLM Integration Options

### Option A: Use Existing LangChain Orchestrator
- ✅ Already has LLM capabilities
- ✅ Can add formatting step to workflow
- ✅ No additional API keys needed

### Option B: Add Gemini API Directly
- ✅ Good for structured data formatting
- ✅ Fast and cost-effective
- ⚠️ Requires API key

### Option C: Add OpenAI/Claude API
- ✅ Excellent natural language generation
- ⚠️ Requires API key
- ⚠️ Additional cost

**Recommendation**: Start with Option A (LangChain), then add Option B (Gemini) if needed for better performance.

---

## Prompt Engineering Template

```typescript
const formatPrompt = `
You are a helpful assistant that formats tool responses into natural language answers.

**User Question**: ${query}

**Tool Used**: ${toolContext.tool}
**Tool Response**: ${JSON.stringify(structuredData)}

**Instructions**:
1. Extract only information relevant to the user's question
2. Format the answer in clear, natural language
3. Include specific details (dates, times, locations, etc.)
4. If multiple items found, present them in a numbered list
5. Keep the answer concise but informative
6. Do NOT include technical details or raw data

**Format your answer as a natural language response:**
`
```

---

## Benefits

1. ✅ **Better UX**: Users get answers, not data dumps
2. ✅ **Context-Aware**: Understands what the user really wants
3. ✅ **Multi-Tool Synthesis**: Combines information from multiple sources
4. ✅ **Maintainable**: Centralized formatting logic
5. ✅ **Flexible**: Can adjust formatting based on query type

---

## Cost Considerations

- **LLM API Calls**: ~$0.01-0.10 per query (depending on model)
- **Caching**: Cache formatted responses to reduce costs
- **Selective Formatting**: Only format complex responses, not simple ones

---

## Next Steps

1. **Prototype**: Implement basic formatter for Playwright responses
2. **Test**: Try with real queries ("find iration tickets in iowa")
3. **Iterate**: Refine prompts based on results
4. **Expand**: Add formatters for other tools (Google Maps, Search)

---

**Recommendation**: Implement **Option 1 (Orchestrator-Level)** with **Phase 1** focusing on Playwright responses first, then expanding to other tools.

