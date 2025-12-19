# Migration Guide: API v0 to v0.1

This document describes the migration from API version `/v0/` to `/v0.1/` to align with the official MCP Registry specification.

## Overview

The MCP Registry API has been updated to match the official MCP v0.1 specification. All endpoints have been migrated from `/v0/` to `/v0.1/` paths.

## Changes

### Endpoint Path Updates

| Old Endpoint | New Endpoint | Status |
|-------------|--------------|--------|
| `GET /v0/servers` | `GET /v0.1/servers` | ✅ Updated |
| `GET /v0/servers/:serverId` | `GET /v0.1/servers/:serverId` | ✅ Updated |
| `POST /v0/publish` | `POST /v0.1/publish` | ✅ Updated |
| `PUT /v0/servers/:serverId` | `PUT /v0.1/servers/:serverId` | ✅ Updated |
| `DELETE /v0/servers/:serverId` | `DELETE /v0.1/servers/:serverId` | ✅ Updated |
| `POST /v0/invoke` | `POST /v0.1/invoke` | ✅ Updated |

### New Features

#### Query Parameters for Server Discovery

The `GET /v0.1/servers` endpoint now supports query parameters for filtering:

- **`?search=<term>`** - Filter servers by name, description, or serverId (case-insensitive)
- **`?capability=<name>`** - Filter servers by capability (e.g., "tools", "resources", "prompts")

**Examples:**
```bash
# Search for servers containing "github"
GET /v0.1/servers?search=github

# Filter by tools capability
GET /v0.1/servers?capability=tools

# Combine filters
GET /v0.1/servers?search=design&capability=tools
```

### Backward Compatibility

⚠️ **Important**: The old `/v0/` endpoints are **no longer available**. All clients must update to use `/v0.1/` paths.

## Migration Steps

### For API Consumers

1. **Update API Base URLs**
   - Change all `/v0/` references to `/v0.1/`
   - Example: `http://localhost:3001/v0/servers` → `http://localhost:3001/v0.1/servers`

2. **Update Frontend Code**
   - The `lib/api.ts` file has been updated automatically
   - If you have custom API calls, update them manually

3. **Test Your Integration**
   - Run the smoke test: `powershell -ExecutionPolicy Bypass -File .\smoke-test-v0.1.ps1`
   - Verify all endpoints respond correctly

### For Backend Developers

1. **Restart the Backend Server**
   ```bash
   cd backend
   npm start
   ```

2. **Verify Routes**
   - Check that routes are mounted at `/v0.1` in `backend/src/server.ts`
   - Verify route handlers in `backend/src/routes/v0/servers.ts`

3. **Test Endpoints**
   ```bash
   # Health check
   curl http://localhost:3001/health
   
   # List servers
   curl http://localhost:3001/v0.1/servers
   
   # Search servers
   curl "http://localhost:3001/v0.1/servers?search=test"
   ```

## Updated Files

### Backend
- `backend/src/server.ts` - Route mounting updated to `/v0.1`
- `backend/src/routes/v0/servers.ts` - Endpoint documentation updated
- `backend/src/routes/v0/invoke.ts` - Endpoint documentation updated
- `backend/src/services/registry.service.ts` - Added query parameter support
- `backend/src/middleware/cors.middleware.ts` - Enhanced CORS documentation

### Frontend
- `lib/api.ts` - All API calls updated to `/v0.1` paths
- `app/page.tsx` - Uses updated API (no changes needed)
- `app/chat/page.tsx` - Uses updated API (no changes needed)

### Documentation
- `README.md` - Updated API endpoint documentation
- `backend/README.md` - Updated with v0.1 paths and query parameters
- `CHANGELOG.md` - Documented changes
- `test-integration.ps1` - Updated test script paths

## Testing

Run the smoke test to verify everything works:

```powershell
powershell -ExecutionPolicy Bypass -File .\smoke-test-v0.1.ps1
```

Expected results:
- ✅ Health check passes
- ✅ `/v0.1/servers` returns server list
- ✅ Query parameters work correctly
- ✅ Old `/v0/` endpoints return 404

## Support

If you encounter any issues during migration:
1. Check that the backend server is running and restarted
2. Verify environment variables are set correctly
3. Review the [Official MCP Registry Developer Guide](./Official%20Model%20Context%20Protocol%20(MCP)%20Registry_%20Developer%20Guide.md)
4. Open an issue on GitHub

## References

- [Official MCP Registry Developer Guide](./Official%20Model%20Context%20Protocol%20(MCP)%20Registry_%20Developer%20Guide.md)
- [MCP Registry GitHub](https://github.com/modelcontextprotocol/registry)
- [MCP Registry API](https://registry.modelcontextprotocol.io/)
