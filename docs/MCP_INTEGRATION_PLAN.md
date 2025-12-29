# MCP Server Integration Plan

**Version:** 1.0  
**Last Updated:** December 2024  
**Status:** Implementation Plan

## Overview

This plan outlines the strategy to fully integrate all 20 MCP servers from the top-20-servers.json manifest, moving them from "Pre-Integration" status to "Active" status.

## Status System Redesign

### Current Status System
- **Online**: All servers (hardcoded)
- **Warning**: Not used
- **Offline**: Not used

### New Status System
- **Active**: Fully integrated and working
  - Tools discovered and validated
  - Package exists on npm (for STDIO servers)
  - Health check passes (for HTTP servers)
  - Successfully tested with sample queries
  
- **Pre-Integration**: Registered but not fully integrated
  - Registered in database
  - Tools not discovered or discovery failed
  - Package may not exist on npm
  - Not yet tested
  
- **Offline**: Server unavailable
  - Health check fails
  - Package installation fails
  - Server errors on invocation

## Integration Criteria

### For STDIO Servers (most of the 20)
A server is **Active** when:
1. ✅ Registered in database
2. ✅ npm package exists and is installable
3. ✅ Tools discovered successfully (tools array populated)
4. ✅ Can initialize MCP connection
5. ✅ At least one tool can be invoked successfully

A server is **Pre-Integration** when:
1. ✅ Registered in database
2. ⚠️ Tools not discovered (empty tools array)
3. ⚠️ Package may not exist on npm
4. ⚠️ Not yet tested

### For HTTP Servers
A server is **Active** when:
1. ✅ Registered in database
2. ✅ Endpoint URL is valid
3. ✅ Health check endpoint responds
4. ✅ MCP protocol endpoint responds
5. ✅ Tools can be listed successfully

## Implementation Steps

### Phase 1: Update Status System

1. **Update Type Definitions**
   - Change status type from `"online" | "offline" | "warning"` to `"active" | "pre-integration" | "offline"`
   - Update `MCPAgent` interface in `types/agent.ts`

2. **Create Integration Status Service**
   - New service: `backend/src/services/integration-status.service.ts`
   - Determines status based on:
     - Tools discovered (has tools = active candidate)
     - Package verification (npm package exists)
     - Health checks (for HTTP servers)
     - Test invocations (can actually call tools)

3. **Update Status Transformation Logic**
   - Modify `lib/server-utils.ts` `transformServerToAgent()` function
   - Call integration status service to determine actual status
   - Cache status to avoid repeated checks

4. **Update UI Components**
   - Update `app/registry/page.tsx`:
     - Change "Warning" to "Pre-Integration"
     - Change "Online" to "Active"
     - Update status filter dropdown
   - Update `components/status-badge.tsx`:
     - Add "active" and "pre-integration" status styles
     - Update color scheme

### Phase 2: Integration Script

1. **Create Integration Verification Script**
   - `backend/src/scripts/verify-mcp-integration.ts`
   - For each server:
     - Verify npm package exists (for STDIO)
     - Attempt tool discovery
     - Test tool invocation
     - Update status in database

2. **Create Integration Test Script**
   - `backend/src/scripts/test-mcp-servers.ts`
   - Test each server with sample queries
   - Record success/failure
   - Generate integration report

### Phase 3: Wire Up All 20 Servers

For each server in `top-20-servers.json`:

1. **Verify Package Exists**
   ```bash
   npm view @modelcontextprotocol/server-playwright
   ```

2. **Discover Tools**
   - Run tool discovery if not already done
   - Update database with discovered tools

3. **Test Integration**
   - Initialize MCP connection
   - List available tools
   - Invoke a simple tool (if available)
   - Record results

4. **Update Status**
   - Set status to "active" if all checks pass
   - Set status to "pre-integration" if checks fail
   - Log reasons for pre-integration status

### Phase 4: Continuous Monitoring

1. **Health Check Service**
   - Periodic health checks for active servers
   - Update status if server becomes unavailable
   - Retry failed servers automatically

2. **Integration Dashboard**
   - Show integration progress
   - Display which servers need attention
   - Track integration metrics

## Server-Specific Integration Tasks

### Servers That Likely Need Special Handling

1. **Playwright** - May need HTTP endpoint instead of STDIO
2. **Filesystem** - Requires directory path argument
3. **Postgres** - Needs DATABASE_URL configuration
4. **Context7** - Uses different package name (@context7/mcp-server)

### Servers That May Not Exist Yet

Some packages may not be published to npm yet:
- `@modelcontextprotocol/server-playwright` (may not exist)
- Others may need verification

## Database Schema Updates

### Add Integration Status Fields

```sql
ALTER TABLE "McpServer" ADD COLUMN "integrationStatus" VARCHAR(50) DEFAULT 'pre-integration';
ALTER TABLE "McpServer" ADD COLUMN "toolsDiscovered" BOOLEAN DEFAULT false;
ALTER TABLE "McpServer" ADD COLUMN "packageVerified" BOOLEAN DEFAULT false;
ALTER TABLE "McpServer" ADD COLUMN "lastHealthCheck" TIMESTAMP;
ALTER TABLE "McpServer" ADD COLUMN "integrationNotes" TEXT;
```

Or use metadata JSON field to store integration status.

## Files to Modify

1. **Type Definitions**
   - `types/agent.ts` - Update status type

2. **Backend Services**
   - `backend/src/services/integration-status.service.ts` - NEW
   - `backend/src/services/registry.service.ts` - Add integration status methods

3. **Frontend Components**
   - `lib/server-utils.ts` - Update status determination logic
   - `app/registry/page.tsx` - Update UI labels and filters
   - `components/status-badge.tsx` - Add new status styles

4. **Scripts**
   - `backend/src/scripts/verify-mcp-integration.ts` - NEW
   - `backend/src/scripts/test-mcp-servers.ts` - NEW
   - `backend/src/scripts/register-top-20-servers.ts` - Update to set initial status

## Success Criteria

- All 20 servers registered in database
- Integration status accurately reflects server state
- UI clearly shows which servers are active vs pre-integration
- Integration script can verify and update status
- Health checks run periodically for active servers

## Timeline

- **Phase 1**: 2-3 hours (Status system update)
- **Phase 2**: 3-4 hours (Integration scripts)
- **Phase 3**: 4-6 hours (Wire up all 20 servers)
- **Phase 4**: 2-3 hours (Monitoring and dashboard)

**Total Estimated Time**: 11-16 hours

