# Playwright Auto-Search Routing Implementation

**Date**: December 26, 2024  
**Status**: ✅ **IMPLEMENTED**

---

## Problem

The auto-search feature was deployed to the LangChain server at `/api/playwright/navigate`, but our frontend was calling the Playwright MCP server directly (which doesn't have the auto-search feature yet).

---

## Solution

Updated the backend `mcp-invoke.service.ts` to detect when a Playwright `browser_navigate` call includes a `search_query` parameter and automatically route it to the LangChain server's auto-search endpoint.

---

## Implementation Details

### Detection Logic

When invoking a tool, the backend checks:
1. ✅ Is it `browser_navigate` tool?
2. ✅ Does `toolArgs` contain `search_query` or `searchQuery`?
3. ✅ Is the server ID for Playwright?

If all conditions are met, the request is routed to:
```
https://langchain-agent-mcp-server-554655392699.us-central1.run.app/api/playwright/navigate
```

### Parameter Mapping

The backend maps parameters from MCP format to LangChain endpoint format:

| MCP Parameter | LangChain Parameter | Required |
|--------------|---------------------|----------|
| `url` | `url` | ✅ Yes |
| `search_query` or `searchQuery` | `search_query` | ✅ Yes (for routing) |
| `auto_search` | `auto_search` | ❌ No (defaults to true) |
| `wait_timeout` | `wait_timeout` | ❌ No |
| `search_box_selector` | `search_box_selector` | ❌ No |
| `search_button_selector` | `search_button_selector` | ❌ No |
| `wait_for_results` | `wait_for_results` | ❌ No |

### Response Format Conversion

The LangChain endpoint returns:
```json
{
  "success": true,
  "url": "...",
  "search_performed": true,
  "search_query": "...",
  "snapshot": "yaml snapshot...",
  "warnings": [],
  "errors": []
}
```

Which is converted to MCP format:
```json
{
  "result": {
    "content": [{
      "type": "text",
      "text": "Successfully navigated to ... and performed search for '...'.\n\nPage Snapshot:\n```yaml\n...\n```"
    }],
    "isError": false
  }
}
```

---

## Fallback Behavior

If `search_query` is **not** present, the request is handled normally through the Playwright MCP server (standard JSON-RPC). This maintains backward compatibility.

---

## Testing

### Test Case 1: With search_query (should route to LangChain)
```typescript
// Frontend sends:
{
  serverId: "com.microsoft.playwright/mcp",
  tool: "browser_navigate",
  arguments: {
    url: "https://www.stubhub.com",
    search_query: "iration tickets in iowa",
    auto_search: true
  }
}

// Backend routes to:
POST https://langchain-agent-mcp-server-554655392699.us-central1.run.app/api/playwright/navigate
Body: {
  url: "https://www.stubhub.com",
  search_query: "iration tickets in iowa",
  auto_search: true
}
```

### Test Case 2: Without search_query (standard flow)
```typescript
// Frontend sends:
{
  serverId: "com.microsoft.playwright/mcp",
  tool: "browser_navigate",
  arguments: {
    url: "https://www.wikipedia.org"
  }
}

// Backend routes to:
POST https://playwright-mcp-http-server-554655392699.us-central1.run.app/mcp
Body: {
  jsonrpc: "2.0",
  method: "tools/call",
  params: {
    name: "browser_navigate",
    arguments: {
      url: "https://www.wikipedia.org"
    }
  }
}
```

---

## Environment Variables

The LangChain endpoint URL can be configured via:
```env
LANGCHAIN_ENDPOINT=https://langchain-agent-mcp-server-554655392699.us-central1.run.app
```

If not set, defaults to the production URL.

---

## Benefits

1. ✅ **Automatic routing** - No frontend changes needed
2. ✅ **Backward compatible** - Standard navigation still works
3. ✅ **Transparent** - Frontend doesn't need to know about routing logic
4. ✅ **Centralized** - All routing logic in one place

---

## Future Improvements

When the Playwright MCP server itself supports auto-search:
- Remove the routing logic
- Let Playwright MCP handle it natively
- Or keep routing as a fallback for older Playwright versions

---

**Status**: ✅ Ready for testing  
**Next Steps**: Test with "go to stubhub.com and look for iration tickets in iowa"

