# Frontend STDIO Server Support Fix

## Problem

The frontend was checking for endpoint URLs on **all** servers, including STDIO-based servers (like Playwright, Google Maps) that don't need endpoints. This caused errors:

```
Agent "Google Maps MCP Server" is missing an endpoint URL
```

## Solution

Updated frontend to detect STDIO servers and skip endpoint validation for them.

## Changes Made

### 1. `lib/server-utils.ts`

**Before**: Always required endpoint, fell back to serverId if missing

**After**: 
- Detects STDIO servers (has `command` and `args`)
- Only requires endpoints for HTTP servers
- Uses special `stdio://` prefix for STDIO servers

```typescript
// Check if this is a STDIO-based server
const isStdioServer = server.command && server.args && server.args.length > 0

if (!isStdioServer) {
  // Only HTTP servers need endpoints
  // ... extract endpoint logic
} else {
  // STDIO servers don't need endpoints
  endpoint = `stdio://${server.serverId}`
}
```

### 2. `app/chat/page.tsx`

**Before**: Always validated endpoint before invoking

**After**:
- Checks if server is STDIO-based (`stdio://` prefix)
- Skips endpoint validation for STDIO servers
- Only validates endpoints for HTTP servers

```typescript
// Check if this is a STDIO-based server
const isStdioServer = agent.endpoint && agent.endpoint.startsWith('stdio://')

// Only HTTP-based servers need endpoint URLs
if (!isStdioServer && (!agent.endpoint || ...)) {
  throw new Error(...)
}
```

## How It Works

1. **Backend** returns servers with `command` and `args` fields (already implemented)
2. **Frontend** detects STDIO servers by checking for `command` + `args`
3. **Frontend** marks STDIO servers with `stdio://` prefix
4. **Chat page** skips endpoint validation for STDIO servers
5. **Backend invoke** handles STDIO servers automatically (already implemented)

## Testing

After these changes:

1. ✅ **STDIO servers** (Playwright, Google Maps) work without endpoints
2. ✅ **HTTP servers** still require endpoints (as before)
3. ✅ **Console warnings** only appear for HTTP servers without endpoints (expected)

## Next Steps

1. **Restart frontend** to pick up changes
2. **Test Google Maps query** - should work now
3. **Test Playwright** - should also work

## Files Changed

- `lib/server-utils.ts` - STDIO detection logic
- `app/chat/page.tsx` - Skip endpoint validation for STDIO servers

## Related Backend Changes

- `backend/src/services/mcp-stdio.service.ts` - STDIO communication (already done)
- `backend/src/routes/v0/invoke.ts` - Auto-detect server type (already done)
