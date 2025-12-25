# Playwright MCP Auto-Search Enhancement Specification

**Document Version**: 1.0  
**Date**: December 25, 2024  
**Status**: 📋 Specification  
**Target**: Playwright MCP Server (`@playwright/mcp` HTTP wrapper)

---

## Overview

Enhance the Playwright MCP server to automatically perform search operations when a `searchQuery` parameter is provided with `browser_navigate`. This eliminates the need for orchestrators to chain multiple tool calls for common search scenarios.

---

## Problem Statement

### Current Behavior

When a user requests to search a website (e.g., "go to stubhub.com and look for iration tickets in iowa"):

1. ✅ `browser_navigate` navigates to the URL
2. ✅ `browser_snapshot` captures the page structure
3. ❌ Search query is **not** automatically entered
4. ❌ Search button is **not** automatically clicked
5. ❌ Results page is **not** captured

**Result**: User sees homepage but no search results, requiring manual multi-step orchestration.

### Desired Behavior

When `browser_navigate` receives a `searchQuery` parameter:

1. ✅ Navigate to the URL
2. ✅ Take a snapshot to locate the search interface
3. ✅ **Automatically** find and fill the search box with the query
4. ✅ **Automatically** click the search button
5. ✅ **Automatically** wait for results and capture the results page
6. ✅ Return the results page snapshot

**Result**: Complete search operation in a single tool call.

---

## Specification

### 1. Enhanced `browser_navigate` Tool

#### 1.1 Updated Input Schema

```typescript
interface BrowserNavigateInput {
  url: string; // Required: The URL to navigate to
  searchQuery?: string; // Optional: Search query to perform
  autoSearch?: boolean; // Optional: Whether to auto-perform search (default: true if searchQuery provided)
  searchBoxSelector?: string; // Optional: Custom selector for search box (fallback to auto-detection)
  searchButtonSelector?: string; // Optional: Custom selector for search button (fallback to auto-detection)
  waitForResults?: boolean; // Optional: Wait for results page to load (default: true)
  waitTimeout?: number; // Optional: Maximum wait time in ms (default: 10000)
}
```

#### 1.2 Behavior

**When `searchQuery` is provided:**

1. Navigate to `url` using `page.goto(url)`
2. Wait for page load (`load` or `networkidle`)
3. Take an accessibility snapshot (`browser_snapshot`) to analyze page structure
4. **Search Box Detection:**
   - Look for common search input patterns:
     - `input[type="search"]`
     - `input[placeholder*="search" i]`
     - `input[name*="search" i]`
     - `input[id*="search" i]`
     - `input[aria-label*="search" i]`
     - Elements with role="searchbox"
   - Priority order: explicit selectors > aria-labels > placeholder text > name/id attributes
   - Use accessibility tree refs from snapshot for reliable element targeting
5. **Type Search Query:**
   - Use `browser_type` equivalent: `page.locator(searchBoxSelector).fill(searchQuery)`
   - Wait for input to be ready (debounce if needed)
6. **Search Button Detection:**
   - Look for button near the search box:
     - `button[type="submit"]` within the same form
     - `button[aria-label*="search" i]`
     - Button with text containing "search", "go", "submit"
     - Enter key simulation (fallback if no button found)
7. **Perform Search:**
   - Click search button OR press Enter in search box
   - Wait for navigation/results load
8. **Capture Results:**
   - Wait for results page (`waitForLoadState('networkidle')` or timeout)
   - Take final snapshot of results page
   - Return results page snapshot as response

**When `searchQuery` is NOT provided:**

- Current behavior (navigate and return snapshot)
- No changes to existing functionality

---

### 2. Search Box Detection Algorithm

#### 2.1 Priority Order

1. **Explicit Selector** (if `searchBoxSelector` provided)
   - Use provided selector directly
2. **Accessibility Tree Analysis**
   - Find elements with `role="searchbox"` or `role="textbox"` + accessible name containing "search"
3. **Common Patterns**
   - `input[type="search"]`
   - `input[placeholder*="search" i]` or similar
   - `input[name*="search" i]` or `input[id*="search" i]`
4. **Contextual Search**
   - For ticket sites: look for placeholders like "Search events", "Find tickets", "Search artists"
   - Use semantic HTML5 search patterns

#### 2.2 Validation

- Verify element is visible (`isVisible()`)
- Verify element is enabled (`isEnabled()`)
- Verify element is an input field (`tagName === 'INPUT'` or `tagName === 'TEXTAREA'`)

---

### 3. Search Button Detection Algorithm

#### 3.1 Priority Order

1. **Explicit Selector** (if `searchButtonSelector` provided)
2. **Form Submit Button**
   - `button[type="submit"]` within the same form as search box
   - `input[type="submit"]` within the same form
3. **Aria Label**
   - Button with `aria-label` containing "search", "submit", "go"
4. **Button Text**
   - Button text matching: "Search", "Go", "Find", "Submit", or icon-only with aria-label
5. **Fallback: Enter Key**
   - If no button found, simulate Enter key press in search box

#### 3.2 Validation

- Verify button is visible and clickable
- Use `element.isVisible()` and `element.isEnabled()`

---

### 4. Error Handling

#### 4.1 Graceful Degradation

If search cannot be performed:

- Log warning but **do not fail** the navigation
- Return the homepage snapshot with a message:
  ```
  Warning: Could not automatically perform search. Search box not found or not accessible. 
  Navigated to: {url}
  ```
- Include the page snapshot so orchestrators can still use multi-step approach

#### 4.2 Specific Error Cases

| Error | Handling |
|-------|----------|
| Search box not found | Warn, return homepage snapshot |
| Search box not visible/enabled | Warn, return homepage snapshot |
| Search button not found | Try Enter key, then warn if that fails |
| Search times out | Return partial results or timeout message |
| Multiple search boxes found | Use first visible/enabled, log which one was used |

#### 4.3 Error Response Format

```typescript
interface BrowserNavigateResponse {
  success: boolean;
  url: string;
  searchPerformed?: boolean;
  searchQuery?: string;
  snapshot?: string; // Accessibility snapshot (YAML format)
  warnings?: string[];
  errors?: string[];
}
```

---

### 5. Performance Considerations

#### 5.1 Timeouts

- **Navigation timeout**: 30 seconds (default Playwright)
- **Search box detection**: 5 seconds
- **Search execution**: 10 seconds (default, configurable via `waitTimeout`)
- **Results load wait**: 10 seconds (default, configurable)

#### 5.2 Optimization

- Cache page snapshots (reuse for search box detection)
- Use `networkidle` wait state for faster results detection
- Parallel element queries where possible

---

### 6. Example Usage

#### 6.1 JSON-RPC Request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "browser_navigate",
    "arguments": {
      "url": "https://www.stubhub.com",
      "searchQuery": "iration tickets in iowa",
      "autoSearch": true,
      "waitForResults": true,
      "waitTimeout": 15000
    }
  }
}
```

#### 6.2 Expected Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Successfully navigated to https://www.stubhub.com and performed search for 'iration tickets in iowa'.\n\nPage Snapshot:\n```yaml\n- heading \"Search Results for iration tickets in iowa\" [ref=e1]\n- list [ref=e2]:\n  - listitem [ref=e3]: Iration - Thu, Jan 15 • 8:00 PM - Orpheum Theater\n  - listitem [ref=e4]: Iration - Sat, Feb 20 • 7:00 PM - Wells Fargo Arena\n  ...\n```"
      }
    ]
  }
}
```

#### 6.3 Fallback Response (Search Failed)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Warning: Could not automatically perform search. Search box was not found or not accessible.\n\nNavigated to: https://www.stubhub.com\n\nPage Snapshot:\n```yaml\n- textbox \"Search events, artists, teams and more\" [ref=e74]\n- button \"Search\" [ref=e75]\n...\n```"
      }
    ],
    "warnings": ["Search box detection failed - page structure may have changed"]
  }
}
```

---

### 7. Implementation Checklist

- [ ] **Update Input Schema**
  - [ ] Add `searchQuery?: string` parameter
  - [ ] Add `autoSearch?: boolean` parameter
  - [ ] Add `searchBoxSelector?: string` parameter
  - [ ] Add `searchButtonSelector?: string` parameter
  - [ ] Add `waitForResults?: boolean` parameter
  - [ ] Add `waitTimeout?: number` parameter

- [ ] **Implement Search Box Detection**
  - [ ] Accessibility tree analysis
  - [ ] Common selector patterns
  - [ ] Contextual patterns for ticket/search sites
  - [ ] Validation (visibility, enabled state)

- [ ] **Implement Search Button Detection**
  - [ ] Form submit button detection
  - [ ] Aria label matching
  - [ ] Text content matching
  - [ ] Enter key fallback

- [ ] **Implement Search Execution Flow**
  - [ ] Type query into search box
  - [ ] Click button or press Enter
  - [ ] Wait for navigation/results
  - [ ] Capture results snapshot

- [ ] **Error Handling**
  - [ ] Graceful degradation
  - [ ] Warning messages
  - [ ] Error response format

- [ ] **Testing**
  - [ ] Test with StubHub
  - [ ] Test with SeatGeek
  - [ ] Test with Eventbrite
  - [ ] Test with Ticketmaster (may still have bot detection)
  - [ ] Test fallback scenarios (no search box found)
  - [ ] Test with custom selectors

- [ ] **Documentation**
  - [ ] Update tool description
  - [ ] Add usage examples
  - [ ] Document error handling

---

### 8. Backward Compatibility

✅ **Fully backward compatible**

- All new parameters are **optional**
- If `searchQuery` is not provided, behavior is identical to current implementation
- No breaking changes to existing API

---

### 9. Integration Points

#### 9.1 SlashMCP.com Frontend

No changes required initially. The frontend already passes `query` parameter to Playwright tools. When the Playwright MCP is updated:

1. Frontend can map `toolArgs.query` to `searchQuery` parameter
2. Or continue using `query` and let Playwright MCP detect it

#### 9.2 Native Orchestrator

Can be simplified once auto-search is available:

```typescript
// Before (current - requires multiple steps)
steps = [
  { tool: 'browser_navigate', args: { url: '...' } },
  { tool: 'browser_snapshot' },
  { tool: 'browser_type', args: { element: 'search box', text: '...' } },
  { tool: 'browser_click', args: { element: 'search button' } },
  { tool: 'browser_snapshot' }
]

// After (simplified - single step)
steps = [
  { tool: 'browser_navigate', args: { url: '...', searchQuery: '...' } }
]
```

---

### 10. Future Enhancements

- **Multi-step Search**: Support for filters, date ranges, location selection
- **Search Result Parsing**: Extract structured data from results (dates, venues, prices)
- **Smart Wait Strategies**: Detect when results are loaded (e.g., wait for specific result count)
- **Search History**: Cache search box patterns for faster subsequent searches on same site
- **A/B Testing**: Try multiple search strategies and return the one that worked

---

## Acceptance Criteria

✅ **Must Have**
- [ ] `browser_navigate` accepts `searchQuery` parameter
- [ ] Automatically detects and fills search box
- [ ] Automatically clicks search button (or presses Enter)
- [ ] Returns results page snapshot
- [ ] Gracefully handles errors (warns, doesn't fail)
- [ ] Fully backward compatible

✅ **Should Have**
- [ ] Support for custom selectors
- [ ] Configurable timeouts
- [ ] Detailed warning/error messages

✅ **Nice to Have**
- [ ] Support for multiple search strategies
- [ ] Search result parsing
- [ ] Caching of search patterns

---

## References

- [Playwright MCP Documentation](https://github.com/microsoft/playwright-mcp)
- **Current Playwright MCP HTTP Endpoint**: `https://playwright-mcp-http-server-554655392699.us-central1.run.app/mcp`
- **Source Repository**: https://github.com/mcpmessenger/playwright-mcp (HTTP wrapper)
- **Original Playwright MCP**: https://github.com/microsoft/playwright-mcp (official Microsoft package)
- [Playwright Locator API](https://playwright.dev/docs/locators)
- [Playwright Accessibility Snapshot](https://playwright.dev/docs/accessibility-snapshot)

---

**End of Specification**

