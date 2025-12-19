# Next Steps - Frontend-Backend Integration

## Current Status ✅

- ✅ Backend fully implemented and running
- ✅ Database set up (PostgreSQL)
- ✅ MCP server seeded
- ✅ Google API keys configured
- ✅ All endpoints ready
- ⚠️ Frontend still using mock data

## Priority 1: Test Backend API (5 minutes)

Verify the backend is working correctly:

```powershell
# 1. Test health endpoint
Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing

# 2. Test registry endpoint
Invoke-WebRequest -Uri "http://localhost:3001/v0/servers" -UseBasicParsing | Select-Object -ExpandProperty Content

# 3. Test SVG generation (if you have API keys)
$body = @{
    description = "minimalist icon, blue palette"
    style = "modern"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3001/api/mcp/tools/generate" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

## Priority 2: Create Frontend API Client (15 minutes)

Create API utilities to connect frontend to backend:

**File: `lib/api.ts`**
- API base URL configuration
- Functions to fetch servers from `/v0/servers`
- Functions for SVG generation
- Functions for job status
- SSE/WebSocket helpers

## Priority 3: Connect Registry Page (20 minutes)

**File: `app/page.tsx`**
- Replace `mockAgents` with API call to `GET /v0/servers`
- Transform backend MCP server format to frontend `MCPAgent` format
- Add loading states
- Add error handling

## Priority 4: Integrate Chat with SVG Generation (30 minutes)

**File: `app/chat/page.tsx`**
- Connect chat messages to backend API
- When user requests SVG generation, call `POST /api/mcp/tools/generate`
- Set up SSE connection to `GET /api/streams/jobs/:jobId` for progress
- Display generated SVG in chat
- Add refine functionality

## Priority 5: Add Real-time Progress Updates (20 minutes)

- Implement EventSource for SSE streaming
- Show progress bar during SVG generation
- Display status messages ("Generating SVG...", "Validating...", etc.)
- Handle completion and errors

## Implementation Order

### Step 1: Create API Client Library

```typescript
// lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function getServers() {
  const response = await fetch(`${API_BASE_URL}/v0/servers`)
  return response.json()
}

export async function generateSVG(description: string, options?: {...}) {
  const response = await fetch(`${API_BASE_URL}/api/mcp/tools/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, ...options })
  })
  return response.json()
}
```

### Step 2: Update Registry Page

Replace mock data with API call:
- Use `useEffect` to fetch servers on mount
- Transform backend format to frontend format
- Handle loading and error states

### Step 3: Update Chat Page

- Detect SVG generation requests in chat
- Call generate API
- Set up SSE for progress
- Display SVG when complete

## Quick Wins

1. **Test backend endpoints** - Verify everything works
2. **Create API client** - Reusable functions for API calls
3. **Connect registry page** - Show real servers from backend
4. **Test SVG generation** - End-to-end test of the workflow

## Testing Checklist

- [ ] Backend health check works
- [ ] Registry API returns servers
- [ ] Frontend can fetch and display servers
- [ ] SVG generation creates a job
- [ ] Progress streaming works (SSE)
- [ ] Generated SVG displays correctly
- [ ] Refine functionality works
- [ ] Error handling works

## Files to Create/Modify

### New Files:
- `lib/api.ts` - API client functions
- `lib/api-client.ts` - API configuration and helpers
- `hooks/use-servers.ts` - React hook for fetching servers
- `hooks/use-job-progress.ts` - React hook for job progress

### Files to Modify:
- `app/page.tsx` - Replace mock data with API calls
- `app/chat/page.tsx` - Integrate with backend API
- `types/agent.ts` - May need to adjust types to match backend format
- `next.config.mjs` - Add API URL environment variable

## Environment Variables Needed

Add to frontend `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Estimated Time

- **Step 1 (API Client)**: 15 minutes
- **Step 2 (Registry Integration)**: 20 minutes  
- **Step 3 (Chat Integration)**: 30 minutes
- **Step 4 (Progress Updates)**: 20 minutes
- **Total**: ~1.5 hours for full integration

## Recommended Next Action

**Start with Step 1**: Create the API client library. This gives you reusable functions to test the backend and makes the rest of the integration easier.

Would you like me to:
1. Create the API client library?
2. Test the backend endpoints first?
3. Start integrating the registry page?
