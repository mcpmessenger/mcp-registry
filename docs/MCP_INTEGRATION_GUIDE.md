# MCP Server Integration Guide

**Quick Reference for Integrating and Managing MCP Servers**

**Last Updated:** December 2024  
**Status:** Active Implementation

## Status System

The registry uses a three-tier status system to track MCP server integration:

### Status Categories

- **Active**: Fully integrated and working
  - Tools discovered and validated
  - Package verified on npm (for STDIO servers)
  - Health checks passing (for HTTP servers)
  - Successfully tested and ready for use

- **Pre-Integration**: Registered but not fully integrated
  - Tools not discovered yet (or discovery failed)
  - Package may not exist on npm
  - Missing required environment variables
  - Not yet tested
  - Server is registered but needs configuration

- **Offline**: Server unavailable
  - Health checks fail
  - Cannot be invoked
  - Server endpoint unreachable

### Status Determination

The `IntegrationStatusService` automatically determines status based on:
- `hasTools`: Whether tools have been discovered
- `packageVerified`: Whether the npm package exists (for STDIO servers)
- `healthCheckPassed`: Whether HTTP health checks pass (for HTTP servers)

## Available Scripts

### 1. Register Top 20 Servers

Registers all 20 servers from the manifest:

```bash
cd backend
npm run register-top-20
```

**What it does:**
- Reads `backend/data/top-20-servers.json`
- Registers each server in the database
- Attempts tool discovery (may fail if packages don't exist)

### 2. Integrate Top 20 Servers

Comprehensive integration script:

```bash
cd backend
npm run integrate-top-20
```

**What it does:**
- Verifies npm packages exist
- Discovers tools for servers with valid packages
- Updates integration status in metadata
- Reports integration progress

### 3. Verify Integration Status

Checks integration status for all servers:

```bash
cd backend
npm run verify-integration
```

**What it does:**
- Checks all registered servers
- Verifies packages (for STDIO servers)
- Checks health endpoints (for HTTP servers)
- Updates status in database metadata
- Generates detailed report

### 4. Test MCP Servers

Tests all active servers:

```bash
cd backend
npm run test-mcp-servers
```

**What it does:**
- Tests tool invocation for active servers
- Verifies servers can actually be called
- Reports success/failure for each server
- Skips pre-integration servers

## Integration Workflow

### Step 1: Register Servers

```bash
npm run register-top-20
```

This registers all 20 servers. Some may fail tool discovery if packages don't exist yet.

### Step 2: Integrate Servers

```bash
npm run integrate-top-20
```

This verifies packages and discovers tools for servers that have valid npm packages.

### Step 3: Verify Status

```bash
npm run verify-integration
```

This checks all servers and updates their integration status.

### Step 4: Test Active Servers

```bash
npm run test-mcp-servers
```

This tests all active servers to ensure they work correctly.

## Status Determination Logic

The status is determined in this order:

1. **Metadata Status** (if stored): Uses `metadata.integrationStatus` from database
2. **Tools Discovered**: If tools exist → `active`, else → `pre-integration`
3. **Default**: `pre-integration`

## UI Updates

The registry page now shows:
- **Active**: Servers with discovered tools
- **Pre-Integration**: Servers without tools or not yet verified
- **Offline**: Servers that are unavailable

## Troubleshooting

### Package Not Found

If a package doesn't exist on npm:
- Server will be marked as `pre-integration`
- Check the package name in `top-20-servers.json`
- Verify the package name is correct
- Some packages may not be published yet

### Tool Discovery Fails

If tool discovery fails:
- Check if the package actually exists: `npm view <package-name>`
- Verify the package supports MCP protocol
- Check server logs for error messages
- Server will remain in `pre-integration` status

### Health Check Fails

For HTTP servers:
- Verify the endpoint URL is correct
- Check if the server is running
- Verify `/health` endpoint exists
- Check network connectivity

## Next Steps

After running integration scripts:

1. **Review Status**: Check the registry UI to see which servers are active
2. **Fix Issues**: Address any pre-integration servers that should be active
3. **Test**: Use `test-mcp-servers` to verify active servers work
4. **Monitor**: Set up periodic health checks (future enhancement)

## Manual Integration

To manually integrate a specific server:

1. **Verify Package**:
   ```bash
   npm view @modelcontextprotocol/server-github
   ```

2. **Discover Tools**:
   ```typescript
   await registryService.discoverToolsForServer('modelcontextprotocol/github')
   ```

3. **Update Status**:
   ```typescript
   await prisma.mcpServer.update({
     where: { serverId: 'modelcontextprotocol/github' },
     data: {
       metadata: JSON.stringify({
         integrationStatus: 'active',
         toolsDiscovered: true,
       }),
     },
   })
   ```

## Files Modified

- `types/agent.ts` - Updated status type
- `lib/server-utils.ts` - Status determination logic
- `app/registry/page.tsx` - UI labels updated
- `components/status-badge.tsx` - New status styles
- `backend/src/services/integration-status.service.ts` - NEW: Integration status service
- `backend/src/scripts/verify-mcp-integration.ts` - NEW: Verification script
- `backend/src/scripts/test-mcp-servers.ts` - NEW: Test script
- `backend/src/scripts/integrate-top-20-servers.ts` - NEW: Integration script

