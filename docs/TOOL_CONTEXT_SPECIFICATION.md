# Tool Context Specification

This document defines the core responsibilities and output contexts for each MCP tool in the SlashMCP.com ecosystem.

## Tool Responsibility Matrix

| Tool | Core Responsibility | Output Context |
|------|-------------------|----------------|
| **Google Maps** | Factual Location | Place IDs, Coordinates, Neighborhood Vibe |
| **Playwright** | Real-time Extraction | Live Prices, Hidden Rules, Contact Details |
| **Search** | Global News | Trends, Alerts, Sentiment |
| **LangChain** | The Orchestrator | Logical Synthesis, Calculations, Reports |

## Detailed Specifications

### Google Maps
**Core Responsibility:** Factual Location
- Provides accurate geographic and location-based information
- Validates and verifies place data
- Delivers structured location metadata

**Output Context:**
- **Place IDs**: Unique identifiers for locations
- **Coordinates**: Latitude/longitude data
- **Neighborhood Vibe**: Contextual information about areas

**Use Cases:**
- Location verification
- Geographic data retrieval
- Area analysis and context

### Playwright
**Core Responsibility:** Real-time Extraction
- Extracts live data from web pages
- Captures dynamic content that changes frequently
- Retrieves information not available through APIs

**Output Context:**
- **Live Prices**: Current pricing information from websites
- **Hidden Rules**: Terms, conditions, or policies not in APIs
- **Contact Details**: Phone numbers, emails, addresses from pages

**Use Cases:**
- Price monitoring
- Terms of service extraction
- Contact information gathering
- Dynamic content scraping

### Search
**Core Responsibility:** Global News
- Aggregates information from multiple sources
- Tracks current events and trends
- Analyzes sentiment and public opinion

**Output Context:**
- **Trends**: Emerging patterns and topics
- **Alerts**: Important news and updates
- **Sentiment**: Public opinion and emotional tone

**Use Cases:**
- News aggregation
- Trend analysis
- Sentiment monitoring
- Alert systems

### LangChain
**Core Responsibility:** The Orchestrator
- Coordinates multiple tools and data sources
- Synthesizes information from various inputs
- Performs complex calculations and generates reports

**Output Context:**
- **Logical Synthesis**: Combined insights from multiple sources
- **Calculations**: Computed results and analytics
- **Reports**: Structured summaries and analyses

**Use Cases:**
- Multi-tool orchestration
- Data synthesis
- Report generation
- Complex calculations

## Integration Patterns

### Tool Selection Logic

When a user request comes in, the system should:

1. **Analyze the request** to determine required output context
2. **Map output context** to appropriate tool(s)
3. **Route to tool** based on core responsibility match
4. **Orchestrate multiple tools** if LangChain is needed

### Example Routing

```
User: "What's the vibe in downtown Seattle and what are current restaurant prices?"

Analysis:
- Needs: Neighborhood Vibe (Google Maps)
- Needs: Live Prices (Playwright)
- Needs: Synthesis (LangChain)

Route:
1. Google Maps → Get neighborhood vibe for downtown Seattle
2. Playwright → Extract current restaurant prices
3. LangChain → Synthesize into coherent report
```

## Implementation Notes

- Each tool should expose its core responsibility in metadata
- Output context should be clearly defined in tool schemas
- Routing logic should match user intent to tool capabilities
- LangChain should be used when multiple tools are needed

## Limitations & Considerations

### LangChain Orchestrator
- **Iteration Limits**: Complex multi-step queries may hit iteration or time limits
- **Recommendation**: For very complex queries, consider breaking them into smaller sub-queries
- **Timeout**: Frontend timeout is 180 seconds; backend may have additional limits

### Multi-Tool Queries
When a query requires multiple tools (e.g., Search → Google Maps → Playwright → LangChain):
1. The system routes to LangChain Orchestrator
2. LangChain coordinates the sequence of tool calls
3. If the sequence is too long, it may hit iteration limits
4. In such cases, consider:
   - Breaking the query into separate requests
   - Increasing agent iteration limits in backend configuration
   - Simplifying the query structure

