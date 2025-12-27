# Bug Report: Metadata Not Merging on Server Updates

## Issue Summary

When updating an MCP server's metadata (e.g., adding HTTP headers), the entire metadata object was being replaced instead of merged, causing existing metadata fields to be lost.

## Root Cause

**File:** `backend/src/services/registry.service.ts`  
**Line:** 346  
**Original Code:**
```typescript
metadata: serverData.metadata ? JSON.stringify(serverData.metadata) : existing.metadata,
```

This logic would:
- If `serverData.metadata` exists → replace entire metadata (losing existing fields)
- If `serverData.metadata` is missing → keep existing metadata

**Problem:** When updating a server, if the frontend only sends specific metadata fields (like `httpHeaders`), it would overwrite the entire metadata object, losing other fields like `endpoint`, `source`, `publisher`, etc.

## Impact

- HTTP headers (`httpHeaders`) could not be added to existing servers without losing other metadata
- Server updates would accidentally clear important metadata fields
- Required repeated re-entry of metadata fields

## Solution

Changed to merge existing metadata with new metadata:

```typescript
// Merge metadata instead of replacing it completely
let mergedMetadata: Record<string, unknown> = {}
if (existing.metadata) {
  try {
    mergedMetadata = JSON.parse(existing.metadata)
  } catch (e) {
    console.warn(`Failed to parse existing metadata for ${serverData.serverId}:`, e)
  }
}
if (serverData.metadata) {
  // Merge new metadata into existing (new values override existing)
  mergedMetadata = { ...mergedMetadata, ...serverData.metadata }
}

metadata: Object.keys(mergedMetadata).length > 0 ? JSON.stringify(mergedMetadata) : existing.metadata,
```

## Testing

1. Create a server with metadata: `{ endpoint: "https://example.com", source: "official" }`
2. Update server with: `{ httpHeaders: { "X-API-Key": "key" } }`
3. Verify final metadata: `{ endpoint: "https://example.com", source: "official", httpHeaders: { "X-API-Key": "key" } }`

## Related Issues

- Google Maps MCP API key configuration failing
- Debug endpoint showing `hasHttpHeaders: false` even after configuration

## Files Changed

- `backend/src/services/registry.service.ts` - Fixed metadata merge logic

