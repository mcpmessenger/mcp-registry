# Playwright Search Enhancement

## Current Status

When navigating to ticket websites like StubHub with a search query (e.g., "go to stubhub.com and look for iration tickets in iowa"), the Playwright MCP currently only:

1. ✅ Navigates to the website (`browser_navigate`)
2. ✅ Captures a page snapshot showing the homepage

**However**, it does **not**:
- ❌ Type the search query into the search box
- ❌ Click the search button
- ❌ Navigate to search results

## The Challenge

Performing a search requires **chaining multiple Playwright tool calls**:

1. `browser_navigate` - Navigate to the website
2. `browser_snapshot` - Capture the page structure to find the search box
3. `browser_type` - Type the search query into the search box (requires element ref from snapshot)
4. `browser_click` - Click the search button (requires element ref from snapshot)
5. `browser_snapshot` - Capture the search results page

## Current Limitations

### Single Tool Call Model
The current chat handler only makes **one tool call** at a time. For Playwright searches, we need a **multi-step workflow**.

### Solutions

#### Option 1: Native Orchestrator Enhancement (Recommended)
Enhance the native orchestrator to create multi-step Playwright workflows when a search query is detected:

```typescript
// In lib/native-orchestrator.ts
if (hasSearchQuery && isPlaywrightServer) {
  steps.push(
    { step: 1, tool: 'browser_navigate', ... },
    { step: 2, tool: 'browser_snapshot', ... },
    { step: 3, tool: 'browser_type', element: 'search box', ... },
    { step: 4, tool: 'browser_click', element: 'search button', ... },
    { step: 5, tool: 'browser_snapshot', ... }, // Get results
  )
}
```

#### Option 2: LangChain Orchestrator
Use the LangChain orchestrator, which can already chain tool calls. Enhance the query:

```
"Navigate to stubhub.com, take a snapshot, find the search box (ref from snapshot), 
type 'iration tickets in iowa' into it, click the search button, and show me the results."
```

#### Option 3: Playwright MCP Enhancement
The Playwright MCP server itself could be enhanced to accept a `searchQuery` parameter in `browser_navigate`:

```json
{
  "tool": "browser_navigate",
  "arguments": {
    "url": "https://www.stubhub.com",
    "searchQuery": "iration tickets in iowa",
    "autoSearch": true  // New parameter
  }
}
```

This would require changes to the Playwright MCP server code.

## Recommended Approach

**Short term**: Use Option 2 (LangChain) with enhanced query instructions.

**Long term**: Implement Option 1 (Native Orchestrator) for better control and performance.

## Implementation Status

- ✅ Link detection in chat messages (clickable URLs)
- ✅ Search query extraction from user input
- ⏳ Multi-step Playwright workflow (in progress)
- ⏳ Automatic search box detection (future)
- ⏳ Playwright MCP auto-search enhancement (future)

## User Experience

Currently, when a user says "go to stubhub.com and look for iration tickets in iowa":

1. System navigates to StubHub ✅
2. System captures homepage snapshot ✅
3. System displays: "I navigated to the website, but the search wasn't automatically performed" ⚠️
4. User sees the homepage but no search results ❌

**With enhancement**:

1. System navigates to StubHub ✅
2. System captures snapshot ✅
3. System types "iration tickets in iowa" into search box ✅
4. System clicks search button ✅
5. System captures and displays search results ✅











