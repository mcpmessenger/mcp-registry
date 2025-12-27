# Response Formatting Issue - Playwright YAML Snapshot Parsing

**Date**: December 25, 2024  
**Status**: In Progress  
**Priority**: High  
**Issue**: Raw YAML snapshots from Playwright are being displayed to users instead of intelligible natural language responses

---

## Problem Statement

When users query for ticket information (e.g., "look for iration concert tickets in iowa"), the system:
1. ✅ Successfully routes to Playwright MCP Server
2. ✅ Successfully navigates to StubHub and performs search
3. ✅ Receives page snapshot data from Playwright
4. ❌ **Fails to format the response** - displays raw YAML instead of natural language

### Current User Experience

**User sees:**
```yaml
- input
- input
- h4 "May"
- h4 "3"
- p "2026"
- button "Get Notified"
...
```

**User should see:**
```
I found 5 events for Iration:

1. **Iration**
   - Date: May 3, 2026
   - Venue: See StubHub for venue details

2. **Iration**
   - Date: April 15, 2026
   - Venue: See StubHub for venue details
...
```

**Or, if no results:**
```
I searched for "iration concert tickets in iowa" on StubHub but didn't find any upcoming events in Iowa. 

The search was successful, but there are currently no Iration concerts scheduled in Iowa. You might want to:
- Check nearby states
- Set up notifications for future Iowa dates
- Browse other artists or events
```

---

## Root Cause Analysis

### 1. Playwright Snapshot Format

Playwright's accessibility snapshot returns structured YAML with:
- List items (`- ` prefix)
- Element types (`h4`, `p`, `button`, etc.)
- Text content in quotes
- Attributes and references

**Example YAML structure:**
```yaml
- h4 "Jan"
- h4 "15"
- p "2026"
- button "Favorite"
- button "See Tickets"
```

### 2. Parsing Challenges

**Challenge 1: Split Date Format**
- Month, day, and year are in separate elements
- Not always adjacent (may have other elements between)
- YAML list format with `- ` prefix

**Challenge 2: Event Association**
- Artist name ("Iration") may appear far from dates
- Need to associate dates with correct artist
- Multiple dates may belong to same artist

**Challenge 3: No Results Detection**
- When no events match, snapshot still contains page structure
- Need to distinguish "no results" from "results loading"
- Should provide helpful user feedback

**Challenge 4: Inconsistent Structure**
- Different ticket sites have different layouts
- CSS classes and attributes can break patterns
- Multi-line text content in elements

---

## What We've Tried

### Attempt 1: Basic Regex Pattern Matching
**Approach**: Single regex to match month-day-year pattern
```typescript
const pattern = /h4\s+"([A-Za-z]{3})"\s*\n\s*h4\s+"(\d+)"\s*\n\s*p\s+"(\d{4})"/g
```
**Result**: ❌ Failed - too strict, didn't handle YAML list format

### Attempt 2: YAML List Format Support
**Approach**: Added support for `- ` prefix
```typescript
const pattern = /(?:-\s+)?h4\s+"([A-Za-z]{3})"\s*\n(?:-\s+)?h4\s+"(\d+)"\s*\n(?:-\s+)?p\s+"(\d{4})"/g
```
**Result**: ❌ Failed - elements may not be consecutive

### Attempt 3: Flexible Whitespace Handling
**Approach**: Allow any content between date elements
```typescript
const pattern = /h4[^\n]*"([A-Za-z]{3})"[^\n]*\n[^\n]*h4[^\n]*"(\d+)"[^\n]*\n[^\n]*p[^\n]*"(\d{4})"/g
```
**Result**: ❌ Failed - matched false positives, missed valid dates

### Attempt 4: Sequential Parsing (Current)
**Approach**: Find months first, then look ahead for days and years
```typescript
// Find all month headings
const monthMatches = [...snapshot.matchAll(/(?:-\s+)?h4\s+"(Jan|Feb|Mar|...)"\s*/gi)]

for (const monthMatch of monthMatches) {
  // Look ahead for day
  const afterMonth = snapshot.substring(monthIndex, monthIndex + 200)
  const dayMatch = afterMonth.match(/(?:-\s+)?h4\s+"(\d{1,2})"/)
  
  if (dayMatch) {
    // Look ahead for year
    const yearMatch = afterDay.match(/(?:-\s+)?p\s+"(\d{4})"/)
    // Combine into date
  }
}
```
**Result**: ⚠️ Partial - finds dates but may miss association with artist

### Attempt 5: Aggressive Fallback Extraction
**Approach**: When "Iration" found but no events, extract ALL dates
```typescript
if (snapshot.includes('Iration') && structured.events?.length === 0) {
  // Extract all dates and assume they're for Iration
  for (const dateMatch of allDates) {
    structured.events?.push({
      name: 'Iration',
      date: fullDate,
      venue: 'See StubHub for venue details',
    })
  }
}
```
**Result**: ⚠️ Partial - works when dates exist, but doesn't handle "no results" case

---

## Current Implementation State

### File: `lib/response-formatter.ts`

**Functions:**
1. `parsePlaywrightSnapshot()` - Parses YAML into structured data
2. `formatAsNaturalLanguage()` - Formats structured data as text
3. `formatResponseWithLLM()` - Main formatter with fallback logic
4. `formatToolResponse()` - Entry point

**Current Flow:**
```
Playwright Response (YAML)
  ↓
formatToolResponse()
  ↓
formatResponseWithLLM()
  ↓
Extract YAML snapshot
  ↓
parsePlaywrightSnapshot() → Try to extract events
  ↓
If no events found:
  ↓
Aggressive extraction (find all dates when "Iration" present)
  ↓
If still no events:
  ↓
Return minimal content message OR raw YAML
```

**Problem**: When no results exist (e.g., no Iration concerts in Iowa), the system:
1. Doesn't find any dates to extract
2. Falls back to showing raw YAML
3. User sees unintelligible technical output

---

## Specific Issues

### Issue 1: No Results Detection

**Scenario**: User searches for "iration concert tickets in iowa"  
**Actual Result**: No upcoming Iration concerts in Iowa  
**Current Behavior**: Shows raw YAML snapshot  
**Expected Behavior**: "I didn't find any upcoming Iration concerts in Iowa. Here are some suggestions..."

**Why it fails:**
- Parser looks for dates but finds none
- Falls through to minimal content check
- But snapshot has >30 lines (full page structure)
- Returns raw YAML instead of helpful message

### Issue 2: Incomplete Date Extraction

**Scenario**: YAML contains dates like:
```yaml
- h4 "May"
- h4 "3"
- p "2026"
```

**Current Behavior**: Sequential parser finds these but may miss edge cases  
**Edge Cases**:
- Dates for different artists on same page
- Dates in different sections
- Dates with unusual formatting

### Issue 3: Artist-Date Association

**Scenario**: Page shows multiple artists with dates  
**Current Behavior**: All dates assumed to be for query artist  
**Problem**: May show wrong artist's dates

### Issue 4: Multi-line Content Handling

**Scenario**: Element text spans multiple lines with CSS:
```yaml
- a "Iration
      .cls-1 {
        fill: none;
    "
```

**Current Behavior**: Parser may not handle multi-line content properly

---

## Proposed Solutions

### Solution 1: Intelligent "No Results" Detection (Priority: High)

**Approach**: Detect when search completed but no relevant results found

**Detection Logic:**
1. Check if search was performed (search query in response)
2. Check if page loaded (has navigation elements)
3. Check if results section exists but is empty
4. Look for "no results" indicators in text

**Implementation:**
```typescript
function detectNoResults(snapshot: string, query: string): boolean {
  // Check for search completion indicators
  const hasSearchPerformed = snapshot.includes('search') || 
                             snapshot.includes('Sort by relevance')
  
  // Check for "no results" text patterns
  const noResultsPatterns = [
    /no.*result/i,
    /no.*found/i,
    /no.*match/i,
    /no.*available/i
  ]
  
  // Check if query artist mentioned but no dates nearby
  const queryArtist = extractArtistName(query)
  const hasArtist = snapshot.includes(queryArtist)
  const hasDates = /h4[^\n]*"(Jan|Feb|Mar|...)/.test(snapshot)
  
  return hasSearchPerformed && 
         (noResultsPatterns.some(p => p.test(snapshot)) ||
          (hasArtist && !hasDates))
}
```

### Solution 2: Enhanced Sequential Parser (Priority: Medium)

**Improvements:**
1. **Context-aware extraction**: Look for dates near artist mentions
2. **Section-aware parsing**: Group dates by page section
3. **Confidence scoring**: Score how likely a date belongs to query artist

**Implementation:**
```typescript
function extractEventsWithContext(snapshot: string, query: string): Event[] {
  const artistName = extractArtistName(query)
  const events: Event[] = []
  
  // Find artist mentions with positions
  const artistMentions = findAllOccurrences(snapshot, artistName)
  
  // For each date found
  for (const date of findAllDates(snapshot)) {
    // Find nearest artist mention
    const nearestArtist = findNearest(artistMentions, date.position)
    const distance = Math.abs(nearestArtist.position - date.position)
    
    // Only associate if within reasonable distance
    if (distance < 1000) {
      events.push({
        name: artistName,
        date: date.fullDate,
        venue: extractVenue(date.position, snapshot),
        confidence: calculateConfidence(distance)
      })
    }
  }
  
  return events
}
```

### Solution 3: LLM-Based Formatting (Priority: Medium-Low)

**Approach**: Use LLM to understand YAML structure and extract information

**Benefits:**
- Handles varied structures
- Understands context
- Provides natural language output

**Drawbacks:**
- Requires LLM API access
- Latency cost
- Cost per request

**Implementation:**
```typescript
async function formatWithLLM(snapshot: string, query: string): Promise<string> {
  const prompt = `Given this YAML snapshot from a ticket website, extract:
1. Event/concert information (artist, dates, venues)
2. Whether search results exist
3. If no results, provide helpful message

Query: "${query}"
YAML: ${snapshot.substring(0, 2000)}

Format as natural language response.`
  
  return await callLLM(prompt)
}
```

### Solution 4: Site-Specific Parsers (Priority: Low)

**Approach**: Create parsers for specific ticket sites (StubHub, Ticketmaster, etc.)

**Benefits:**
- Highly accurate for known sites
- Can use site-specific patterns

**Drawbacks:**
- Maintenance burden
- Doesn't scale to new sites

---

## Immediate Action Plan

### Phase 1: Fix "No Results" Case (Next)

1. **Implement no-results detection**
   - Check for search completion
   - Detect empty results sections
   - Provide helpful user feedback

2. **Improve fallback messaging**
   - When no events found, don't show raw YAML
   - Show: "I searched but didn't find any results. Try..."
   - Include suggestions for next steps

### Phase 2: Improve Date Extraction (Short-term)

1. **Enhance sequential parser**
   - Add context-aware association
   - Improve multi-line handling
   - Handle edge cases

2. **Add venue extraction**
   - Look for venue text near dates
   - Extract from links or nearby elements

### Phase 3: Long-term Improvements (Future)

1. **LLM integration** (if available)
   - Use for complex parsing
   - Fallback to rule-based

2. **Site-specific parsers**
   - For major ticket sites
   - Community-contributed parsers

---

## Test Cases

### Test Case 1: No Results
**Input**: "look for iration concert tickets in iowa"  
**Expected**: "I searched for Iration concerts in Iowa but didn't find any upcoming events. Try checking nearby states or setting up notifications."  
**Current**: Raw YAML

### Test Case 2: Results Found
**Input**: "look for iration concert tickets"  
**Expected**: Formatted list of events with dates and venues  
**Current**: Partially works, may show raw YAML

### Test Case 3: Multiple Artists
**Input**: "find concert tickets"  
**Expected**: List of all concerts found  
**Current**: May associate dates with wrong artist

### Test Case 4: Different Ticket Site
**Input**: "go to ticketmaster.com and search for lcd soundsystem"  
**Expected**: Results formatted regardless of site  
**Current**: May fail on different site structures

---

## Metrics for Success

1. **No Raw YAML**: 100% of responses should be natural language
2. **Accurate Extraction**: >90% of visible dates extracted
3. **Helpful No-Results**: All "no results" cases provide actionable feedback
4. **User Satisfaction**: Users understand responses without seeing technical details

---

## Related Files

- `lib/response-formatter.ts` - Main formatter implementation
- `app/chat/page.tsx` - Response display logic
- `lib/workflow-executor.ts` - Workflow result formatting
- `docs/PLAYWRIGHT_AUTO_SEARCH_SPEC.md` - Playwright search feature spec

---

## Notes

- The sequential parser approach is promising but needs refinement
- "No results" case is currently the biggest user-facing issue
- LLM-based approach would be most robust but requires infrastructure
- Consider A/B testing different parsing approaches

---

**Last Updated**: December 25, 2024  
**Next Review**: After Phase 1 implementation

---

## Implementation Update: Semantic Orchestrator (Latest)

**Status**: ✅ Implemented

Following architectural guidance, we've implemented a Semantic Orchestrator approach with:

### New Components Added

1. **Intent Anchor Extraction** (`extractQueryEntities`)
   - Extracts artist and location from user queries
   - Provides location synonyms for matching (e.g., "Iowa" → ["IA", "Des Moines", "Cedar Rapids"])

2. **Windowed Parser** (`extractWithAnchorWindow`)
   - Finds artist mentions as "anchors" in YAML
   - Scans 25-line windows around each anchor for date patterns
   - Provides confidence scoring based on context (e.g., "See Tickets" button presence)

3. **Negative Result Generator** (`generateNegativeResult`)
   - Detects "no results" scenarios BEFORE attempting extraction
   - Handles multiple cases:
     - Explicit "no results" text
     - Artist found but no dates nearby
     - Search completed but minimal content
   - Returns contextually appropriate messages

4. **Final Guardrail** (`finalGuardrail`)
   - Intercepts any raw YAML/JSON before it reaches the user
   - Provides helpful fallback message
   - Prevents "Lost in Translation" leaks

5. **YAML Cleaner** (`cleanYamlForLLM`)
   - Strips accessibility noise (CSS classes, graphics-symbols)
   - Prepares clean data for future LLM processing
   - Reduces token usage

### New Processing Flow

```
User Query → Extract Entities (Artist, Location)
    ↓
Check Negative Results FIRST
    ↓ (if no negative result)
Find Artist Anchors in YAML
    ↓
Windowed Parsing (25 lines around each anchor)
    ↓
Extract Dates with Confidence Scoring
    ↓
Format Natural Language Response
    ↓
Final Guardrail Check
    ↓
Return to User
```

### Expected Improvements

- ✅ No more raw YAML leaks (guardrail catches everything)
- ✅ Intelligent "no results" detection with helpful messages
- ✅ Context-aware date extraction (only near relevant artists)
- ✅ Better handling of edge cases

### Next Steps

- Test with various queries (with results, no results, multiple artists)
- Refine confidence scoring thresholds
- Consider LLM integration for complex cases (when available)

