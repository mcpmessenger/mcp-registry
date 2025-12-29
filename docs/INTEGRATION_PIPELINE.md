# MCP Server Integration Pipeline

**Complete workflow to move servers from Pre-Integration/Offline → Active status**

## Pipeline Overview

```
Pre-Integration/Offline → [Integration Steps] → Active
```

## Integration Steps

### Step 1: Package/Endpoint Verification

**For STDIO Servers:**
- Verify npm package exists: `npm view <package-name> version`
- Check package is installable
- Result: `packageVerified: true/false`

**For HTTP Servers:**
- Verify endpoint URL is valid
- Check health endpoint responds: `GET /health`
- Result: `healthCheckPassed: true/false`

### Step 2: Tool Discovery

- Initialize MCP connection to server
- Call `tools/list` method
- Parse and store tool schemas
- Result: `hasTools: true/false`, `toolsCount: N`

### Step 3: Tool Validation

- Test tool invocation with sample parameters
- Verify tool returns expected response
- Check for errors or timeouts
- Result: `toolsValidated: true/false`

### Step 4: Status Update

Based on results:
- ✅ **Active**: All checks pass (package verified, tools discovered, tools validated)
- ⚠️ **Pre-Integration**: Package exists but tools not discovered, or discovery failed
- ❌ **Offline**: Health check fails, package not found, or server unreachable

## Current Implementation

### Backend Services

1. **IntegrationStatusService** (`backend/src/services/integration-status.service.ts`)
   - `getIntegrationStatus(server)`: Determines current status
   - `verifyNpmPackage(packageName)`: Checks npm package exists
   - `checkHttpHealth(endpoint)`: Checks HTTP server health
   - `getBatchIntegrationStatus(servers)`: Batch processing

2. **RegistryService** (`backend/src/services/registry.service.ts`)
   - `discoverStdioTools(serverData)`: Discovers tools for STDIO servers
   - `discoverHttpTools(serverData)`: Discovers tools for HTTP servers

### Scripts

1. **verify-integration** (`backend/src/scripts/verify-mcp-integration.ts`)
   - Checks all servers
   - Updates integration status in metadata
   - Generates status report

2. **integrate-top-20** (`backend/src/scripts/integrate-top-20-servers.ts`)
   - Verifies packages
   - Discovers tools
   - Updates status

3. **test-mcp-servers** (`backend/src/scripts/test-mcp-servers.ts`)
   - Tests tool invocation
   - Validates server functionality

## Integration Criteria

### STDIO Server → Active

✅ All of:
1. Package exists on npm (`packageVerified: true`)
2. Tools discovered (`hasTools: true`, `toolsCount > 0`)
3. Tools validated (can invoke at least one tool)

### HTTP Server → Active

✅ All of:
1. Endpoint URL valid
2. Health check passes (`healthCheckPassed: true`)
3. Tools discovered (`hasTools: true`, `toolsCount > 0`)
4. Tools validated (can invoke at least one tool)

## Status Transition Rules

```
Pre-Integration → Active:
  - Package verified ✅
  - Tools discovered ✅
  - Tools validated ✅

Pre-Integration → Offline:
  - Package not found ❌
  - OR health check fails ❌

Offline → Active:
  - Package found ✅
  - Health check passes ✅
  - Tools discovered ✅
  - Tools validated ✅

Active → Offline:
  - Health check fails ❌
  - OR tools no longer accessible ❌
```

## Manual Integration Process

### For STDIO Servers:

```bash
# 1. Verify package
npm view @modelcontextprotocol/server-github version

# 2. Discover tools (via registry service)
# This happens automatically when server is registered

# 3. Test tool invocation
# Use test-mcp-servers script or manual testing
```

### For HTTP Servers:

```bash
# 1. Verify endpoint
curl https://mcp.example.com/health

# 2. Discover tools (via registry service)
# This happens automatically when server is registered

# 3. Test tool invocation
# Use test-mcp-servers script or manual testing
```

## Automated Integration

Run the integration scripts in order:

```bash
# Step 1: Register servers (if not already registered)
cd backend
npm run register-top-20

# Step 2: Integrate servers (verify packages, discover tools)
npm run integrate-top-20

# Step 3: Verify integration status
npm run verify-integration

# Step 4: Test active servers
npm run test-mcp-servers
```

## Integration Status Metadata

Status information is stored in server metadata:

```json
{
  "integrationStatus": "active" | "pre-integration" | "offline",
  "integrationReason": "Tools discovered and package verified",
  "integrationDetails": {
    "hasTools": true,
    "toolsCount": 5,
    "packageVerified": true,
    "healthCheckPassed": true,
    "lastChecked": "2024-12-22T12:00:00Z"
  },
  "integrationCheckedAt": "2024-12-22T12:00:00Z"
}
```

## Next Steps

To expose this in the chat interface:
1. Create API endpoint to trigger integration check
2. Add UI button/command in chat to check server status
3. Show integration progress and results
4. Allow users to trigger tool discovery manually
5. Display integration status in chat messages

