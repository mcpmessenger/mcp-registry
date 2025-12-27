# LangChain Agent MCP Server Error Specification

## ✅ Status: RESOLVED

**Last Updated**: 2025-01-XX  
**Status**: Issue has been fixed and service redeployed  
**New Revision**: `langchain-agent-mcp-server-00023-pgq`  
**Service URL**: `https://langchain-agent-mcp-server-554655392699.us-central1.run.app`

The `system_instruction` parameter issue has been resolved in the latest deployment. The service is now live and serving 100% of traffic.

---

## Issue (Historical)

When invoking the `agent_executor` tool on the LangChain Agent MCP Server, we received the following error:

```
HTTP 500: {
  "content": [{
    "type": "text",
    "text": "Agent execution failed: get_agent() got an unexpected keyword argument 'system_instruction'"
  }],
  "isError": true
}
```

## Current Implementation

### Request Format

We're calling the LangChain server at:
- **Endpoint**: `https://langchain-agent-mcp-server-554655392699.us-central1.run.app/mcp/invoke`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **API Format**: `custom` (not standard MCP JSON-RPC)

### Request Payload

```json
{
  "tool": "agent_executor",
  "arguments": {
    "query": "user query string here"
  }
}
```

**Example Request**:
```json
{
  "tool": "agent_executor",
  "arguments": {
    "query": "Finally, use LangChain to draft a travel itinerary that includes the concert time, the rental pickup location, and the total estimated cost"
  }
}
```

### Code Location

This request is sent from:
- **File**: `backend/src/services/mcp-invoke.service.ts`
- **Method**: `invokeHttpTool()`
- **Lines**: 186-206

```typescript
if (apiFormat === 'custom' || endpoint.includes('/mcp/invoke')) {
  const invokeUrl = endpoint.endsWith('/mcp/invoke') 
    ? endpoint 
    : `${endpoint.replace(/\/$/, '')}/mcp/invoke`

  response = await fetch(invokeUrl, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify({
      tool: toolName,
      arguments: toolArgs,
    }),
  })
}
```

## Error Analysis

### Error Message
```
get_agent() got an unexpected keyword argument 'system_instruction'
```

This suggests that:
1. The LangChain server code is calling a `get_agent()` function
2. It's passing `system_instruction` as a keyword argument
3. The `get_agent()` function doesn't accept this parameter (likely due to LangChain API version mismatch)

### Root Cause
The LangChain Agent MCP Server is likely using an outdated LangChain API. In newer versions of LangChain, the API for creating agents may have changed, or the `system_instruction` parameter may need to be passed differently.

## Expected Behavior

### Successful Response Format

We expect the server to return:
```json
{
  "content": [{
    "type": "text",
    "text": "Generated itinerary or response text"
  }],
  "isError": false
}
```

Or alternatively:
```json
{
  "result": {
    "content": [{
      "type": "text",
      "text": "Generated itinerary or response text"
    }]
  }
}
```

### Use Case

The LangChain Agent is being used in multi-step workflows for tasks like:
- Drafting travel itineraries
- Synthesizing results from multiple tool calls
- Generating natural language summaries

**Example Workflow**:
1. Step 1: Playwright - Find concert information
2. Step 2: Google Maps - Find car rental agencies
3. Step 3: Playwright - Get rental pricing
4. Step 4: **LangChain** - Draft itinerary combining all information

## Proposed Fix

### Option 1: Update LangChain Server Code
The server code should update how it calls `get_agent()`:

**Old (causing error)**:
```python
agent = get_agent(system_instruction="...")
```

**New (if using newer LangChain API)**:
```python
# Check LangChain version and use appropriate API
# For LangChain 0.2+, system_instruction may need to be passed differently
# or the function signature may have changed
```

### Option 2: Support Optional Parameters
If `system_instruction` is optional, make it so in the server code:
```python
def get_agent(system_instruction=None, **kwargs):
    # Handle system_instruction if provided
    # Otherwise use default behavior
```

### Option 3: Version Compatibility
Check LangChain version and use the appropriate API:
```python
import langchain
from packaging import version

if version.parse(langchain.__version__) >= version.parse("0.2.0"):
    # Use newer API
    agent = create_agent(system_prompt="...")
else:
    # Use older API
    agent = get_agent(...)
```

## Testing

To test the fix, we can invoke the tool with a simple query:

```bash
curl -X POST https://langchain-agent-mcp-server-554655392699.us-central1.run.app/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "agent_executor",
    "arguments": {
      "query": "Draft a simple travel itinerary for a concert in New York"
    }
  }'
```

## Additional Context

### Server Registration
The LangChain server is registered in:
- **File**: `backend/src/scripts/register-official-servers.ts`
- **Server ID**: `com.langchain/agent-mcp-server`
- **Version**: `1.0.0`

### Related Files
- `backend/src/services/mcp-invoke.service.ts` - Tool invocation logic
- `lib/native-orchestrator.ts` - Workflow orchestration
- `lib/workflow-executor.ts` - Workflow step execution

## Questions for LangChain Server Maintainer

1. What version of LangChain is the server using?
2. Can we see the current `get_agent()` implementation?
3. Should we send additional parameters in the request?
4. Is there a specific LangChain API version we should target?

