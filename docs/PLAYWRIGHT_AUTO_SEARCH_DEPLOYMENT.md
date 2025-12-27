# Playwright Auto-Search Feature - Deployment Update

**Date**: December 26, 2024  
**Status**: ✅ **DEPLOYED AND OPERATIONAL**

---

## 🎉 Feature Now Live!

The Playwright auto-search feature has been successfully deployed! The Playwright navigation endpoint now automatically performs search operations when a search query is provided.

---

## 📍 Service Endpoint

**Base URL**: `https://langchain-agent-mcp-server-554655392699.us-central1.run.app`  
**New Endpoint**: `POST /api/playwright/navigate`

**Note**: The feature is deployed on the LangChain agent MCP server, which wraps Playwright functionality.

---

## 🚀 What Changed

### New Parameter Support

The `browser_navigate` tool now accepts a `search_query` parameter that triggers automatic search execution:

```json
{
  "url": "https://www.stubhub.com",
  "search_query": "iration tickets in iowa",
  "auto_search": true,                    // Optional, default: true
  "wait_timeout": 15000                   // Optional, default: 10000ms
}
```

### Behavior

When `search_query` is provided:
1. ✅ Navigate to URL
2. ✅ **Auto-detect** search box
3. ✅ **Auto-fill** search query
4. ✅ **Auto-click** search button (or press Enter)
5. ✅ **Auto-wait** for results
6. ✅ Return results page snapshot

**Result**: Complete search in a single API call!

---

## 🔄 Integration with SlashMCP.com

### Current Flow

1. User says: "go to stubhub.com and look for iration tickets in iowa"
2. Frontend extracts URL and search query
3. Frontend calls `invokeMCPTool` with Playwright `browser_navigate`
4. Backend proxies to Playwright MCP server
5. **NEW**: If `search_query` is present, auto-search executes!

### Code Changes Needed

#### Frontend (`app/chat/page.tsx`)

Update to pass `search_query` parameter:

```typescript
// When calling Playwright browser_navigate with a search query
toolArgs = {
  url: 'https://www.stubhub.com',
  search_query: 'iration tickets in iowa',  // NEW: Use snake_case
  auto_search: true,                          // NEW: Explicitly enable
  wait_timeout: 15000                         // NEW: Configurable timeout
}
```

#### Backend (`backend/src/services/mcp-invoke.service.ts`)

Ensure `search_query` parameter is passed through to the Playwright MCP server when invoking HTTP tools.

---

## 📋 Parameter Mapping

| Specification (camelCase) | Implementation (snake_case) | Required |
|--------------------------|----------------------------|----------|
| `searchQuery`            | `search_query`             | No       |
| `autoSearch`             | `auto_search`              | No       |
| `searchBoxSelector`      | `search_box_selector`      | No       |
| `searchButtonSelector`   | `search_button_selector`   | No       |
| `waitForResults`         | `wait_for_results`         | No       |
| `waitTimeout`            | `wait_timeout`             | No       |

**Note**: The implementation uses snake_case (Python convention) rather than camelCase (TypeScript convention).

---

## ✅ Testing

### Test Cases

1. **Simple Navigation** (backward compatible)
   ```json
   { "url": "https://www.wikipedia.org" }
   ```
   ✅ Should work as before

2. **Navigation with Search**
   ```json
   {
     "url": "https://www.stubhub.com",
     "search_query": "iration tickets in iowa"
   }
   ```
   ✅ Should automatically perform search and return results

3. **Custom Timeout**
   ```json
   {
     "url": "https://www.stubhub.com",
     "search_query": "iration tickets",
     "wait_timeout": 20000
   }
   ```
   ✅ Should wait up to 20 seconds for results

---

## 🔧 Code Updates Required

### 1. Update Frontend Tool Arguments

**File**: `app/chat/page.tsx`

```typescript
// Find the section where toolArgs are built for Playwright
if (toolName.includes('browser_navigate') || toolName.includes('navigate')) {
  // ... existing URL extraction ...
  
  // Extract search query (already done, but needs parameter name update)
  if (searchMatch) {
    const searchQuery = searchMatch[1].trim()
    const locationMatch = content.match(/(?:in|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
    const location = locationMatch ? locationMatch[1] : ''
    const fullQuery = location ? `${searchQuery} ${location}` : searchQuery
    
    // UPDATE: Use snake_case parameter name
    toolArgs.search_query = fullQuery  // Changed from searchQuery
    toolArgs.auto_search = true         // NEW: Explicitly enable
    toolArgs.wait_timeout = 15000       // NEW: Set reasonable timeout
  }
}
```

### 2. Verify Backend Pass-Through

**File**: `backend/src/services/mcp-invoke.service.ts`

Ensure the backend correctly forwards all tool arguments including `search_query` to the HTTP MCP server.

---

## 🐛 Troubleshooting

### Issue: Search not executing

**Check**:
- Is `search_query` parameter present in the tool arguments?
- Is the parameter name `search_query` (snake_case), not `searchQuery`?
- Check backend logs to verify parameters are being passed through

### Issue: Timeout errors

**Solution**: Increase `wait_timeout` to 20000-30000ms for slow-loading sites

### Issue: Wrong search box detected

**Solution**: Provide `search_box_selector` parameter with explicit CSS selector

---

## 📊 Performance

- **Default timeout**: 10 seconds
- **Recommended timeout**: 15-20 seconds for ticket sites
- **Memory**: 2Gi allocated
- **CPU**: 2 cores

---

## 🎯 Next Steps

1. ✅ **Update Frontend**: Modify `app/chat/page.tsx` to use `search_query` parameter
2. ✅ **Test**: Verify auto-search works with StubHub, SeatGeek, etc.
3. ✅ **Document**: Update user-facing docs if needed
4. ⏳ **Monitor**: Watch for any issues in production

---

## 📝 Example Request/Response

### Request
```json
{
  "serverId": "com.microsoft.playwright/mcp",
  "tool": "browser_navigate",
  "arguments": {
    "url": "https://www.stubhub.com",
    "search_query": "iration tickets in iowa",
    "auto_search": true,
    "wait_timeout": 15000
  }
}
```

### Response
```json
{
  "content": [
    {
      "type": "text",
      "text": "Successfully navigated to https://www.stubhub.com and performed search for 'iration tickets in iowa'.\n\nPage Snapshot:\n```yaml\n- heading \"Search Results\" [ref=e1]\n- list [ref=e2]:\n  - listitem [ref=e3]: Iration - Thu, May 15 • 8:00 PM - Wells Fargo Arena\n  ...\n```"
    }
  ],
  "isError": false
}
```

---

**Status**: ✅ Ready for integration  
**Deployment Date**: December 26, 2024  
**Service Revision**: langchain-agent-mcp-server-00022-fcn

