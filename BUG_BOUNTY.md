# Bug Bounty: Design Generation via STDIO MCP Server Hanging

## 🎯 Objective

Successfully generate design images through the MCP Registry by invoking the `generate_image` tool from the **Nano-Banana-MCP** server (an STDIO-based MCP server) and return the result to the frontend chat interface.

## 📋 Current System Architecture

### Frontend (`app/chat/page.tsx`)
- User sends design request (e.g., "Design a minimalist coffee shop poster with dark background and purple accents")
- Frontend detects design requests and routes to `/api/mcp/tools/generate` endpoint
- Frontend polls `/api/mcp/tools/job/:jobId` for status updates
- Expected: Display generated image URL or base64 data in chat

### Backend Flow (`backend/src/routes/mcp/tools.ts`)
1. **Route**: `POST /api/mcp/tools/generate`
2. **Logic**:
   - Finds registered MCP server (Nano-Banana-MCP) with `generate_image` tool
   - If server has no tools, attempts on-demand tool discovery (15s timeout)
   - Calls `mcpInvokeService.invokeTool()` to execute the tool
   - Returns either:
     - **Synchronous result**: `{ completed: true, imageUrl: "...", ... }` if tool returns immediately
     - **Asynchronous job**: `{ jobId: "...", status: "PENDING" }` for polling

### MCP Invoke Service (`backend/src/services/mcp-invoke.service.ts`)
- **HTTP servers**: Makes HTTP POST request to server endpoint
- **STDIO servers**: Spawns process, communicates via JSON-RPC over stdin/stdout
  - Sends `initialize` request
  - Waits for `initialize` response
  - Sends `tools/call` request with tool name and arguments
  - Waits for `tools/call` response
  - Parses result and returns

### Registry Service (`backend/src/services/registry.service.ts`)
- Manages MCP server registration in database
- **Tool Discovery**: For STDIO servers, spawns process and calls `tools/list` to populate `tools` array
- Can be triggered:
  - Automatically after server registration
  - On-demand when tools are missing (with timeout)
  - Manually via `POST /v0.1/servers/:serverId/discover-tools`

## 🔧 What We've Tried

### 1. Initial Implementation
- ✅ Created `/api/mcp/tools/generate` endpoint
- ✅ Implemented basic STDIO server invocation
- ✅ Added tool discovery mechanism
- ❌ **Issue**: Tool call was sent before `initialize` response received (fixed delay of 500ms)

### 2. Fixed Initialize Sequence
- ✅ Modified `invokeStdioTool` to wait for `initialize` response before sending tool call
- ✅ Increased timeout from 60s to 120s for image generation
- ✅ Added separate request IDs for initialize (1) and tool call (2)
- ✅ Added detailed logging
- ❌ **Issue**: TypeScript compilation error - `requestId` variable not found (line 333)

### 3. Tool Discovery
- ✅ Pre-installed `nano-banana-mcp` in Dockerfile to speed up discovery
- ✅ Added 15-second timeout for on-demand discovery
- ✅ Background discovery continues if timeout exceeded
- ✅ Fixed npm permission issues by setting `NPM_CONFIG_CACHE` and `HOME` env vars
- ✅ Verified tools are discovered: `generate_image` tool is in database

### 4. Synchronous Result Handling
- ✅ Modified backend to detect immediate results (image URLs/base64) from MCP tools
- ✅ Frontend checks for `completed: true` flag to skip polling
- ❌ **Issue**: Requests still hang for 3+ minutes, no response received

## 🐛 Current Problem

**Symptom**: Design generation requests hang for 3+ minutes with no response. Network tab shows:
- `POST /api/mcp/tools/generate` takes 7-9 seconds
- Multiple `GET /api/mcp/tools/job/:jobId` requests (polling)
- No final result returned

**Hypothesis**: The STDIO tool invocation is not properly receiving or parsing the response from the MCP server.

## 🔍 Debugging Information

### Server Configuration
- **Server ID**: `com.mcp-registry/nano-banana-mcp`
- **Type**: STDIO
- **Command**: `npx`
- **Args**: `["-y", "nano-banana-mcp"]`
- **Environment**: `{ GEMINI_API_KEY: "..." }`
- **Tools**: 6 tools discovered, including `generate_image`

### Expected MCP Protocol Flow
```
Client → Server: {"jsonrpc":"2.0","id":1,"method":"initialize",...}
Server → Client: {"jsonrpc":"2.0","id":1,"result":{...}}
Client → Server: {"jsonrpc":"2.0","method":"notifications/initialized"}
Client → Server: {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{...}}
Server → Client: {"jsonrpc":"2.0","id":2,"result":{...}}
```

### Current Implementation Issues
1. **Line 333**: `requestId` variable doesn't exist (should be `initRequestId`)
2. **Buffer Parsing**: May not handle multi-line JSON responses correctly
3. **Response Format**: May not match expected MCP result structure
4. **Timeout**: 120s may be too long, or process may hang before timeout

## 🎯 Success Criteria

1. ✅ User sends design request in chat
2. ✅ Backend finds Nano-Banana-MCP server and `generate_image` tool
3. ✅ Backend spawns STDIO process and completes MCP handshake
4. ✅ Backend sends `tools/call` request with correct parameters
5. ✅ MCP server generates image and returns result
6. ✅ Backend parses response and extracts image URL/base64
7. ✅ Frontend receives result and displays image in chat
8. ✅ **Total time**: < 60 seconds

## 📝 Files to Review

### Critical Files
- `backend/src/services/mcp-invoke.service.ts` (lines 207-358) - STDIO invocation logic
- `backend/src/routes/mcp/tools.ts` (lines 1-200) - Generate endpoint
- `backend/src/services/registry.service.ts` (lines 200-300) - Tool discovery

### Supporting Files
- `app/chat/page.tsx` - Frontend chat interface
- `lib/api.ts` - API client functions
- `backend/Dockerfile.debian` - Docker build configuration

## 🚀 Next Steps to Try

1. ✅ **Fix TypeScript Error**: Changed `requestId++` to `initRequestId` on line 333
2. ✅ **Implement Line-Buffered Reading**: Replaced buffer accumulation with `readline` module for proper JSON-RPC message parsing
3. ✅ **Add State Machine**: Implemented proper state management (`INITIALIZING` → `INITIALIZED` → `CALLING` → `COMPLETE`)
4. ✅ **Fix Initialized Notification**: Now sends `notifications/initialized` AFTER receiving initialize response (not before)
5. ✅ **Improve Stderr Logging**: All stderr output is now logged (except npm noise) to catch API errors
6. ✅ **Add Shell Mode**: Set `shell: true` for npx to work correctly
7. ✅ **Enhanced Logging**: Log every JSON-RPC message received with truncated content
8. **Test Deployment**: Deploy and test with actual design generation request
9. **Monitor Cloud Run Logs**: Check logs for stderr output from Gemini API (401, 429, etc.)

## 🔗 Related Resources

- **Nano-Banana-MCP**: https://github.com/ConechoAI/Nano-Banana-MCP
- **MCP Protocol Spec**: https://modelcontextprotocol.io
- **Backend URL**: https://mcp-registry-backend-554655392699.us-central1.run.app
- **Cloud Run Logs**: Available in Google Cloud Console

## 💡 Potential Root Causes

1. **JSON-RPC Parsing**: Buffer may not be split correctly on newlines
2. **Response Format Mismatch**: Server may return different format than expected
3. **Process Hanging**: Server process may be waiting for input or stuck
4. **Environment Variables**: API key may not be passed correctly
5. **Network/Timeout**: Cloud Run may have different timeout behavior
6. **Buffer Accumulation**: May not handle large responses correctly

## 📊 Test Cases

### Test Case 1: Simple Tool Call
```json
{
  "toolName": "generate_image",
  "toolArgs": {
    "prompt": "A simple red circle",
    "style": "minimalist"
  }
}
```
**Expected**: Returns image URL within 30 seconds

### Test Case 2: Complex Design Request
```json
{
  "toolName": "generate_image",
  "toolArgs": {
    "prompt": "Design a minimalist coffee shop poster with dark background and purple accents",
    "style": "poster"
  }
}
```
**Expected**: Returns image URL within 60 seconds

---

**Last Updated**: 2025-12-24
**Status**: 🟡 In Progress - Implemented recommended fixes, awaiting deployment and testing
**Priority**: 🔥 Critical - Core feature not working

## ✅ Recent Fixes Applied (2025-12-24)

### Fix A: Line-Buffered Reading
- ✅ Replaced buffer accumulation with `readline.createInterface()` for proper newline-delimited JSON parsing
- ✅ Each line is parsed as a complete JSON-RPC message

### Fix B: State Machine
- ✅ Implemented proper state management: `INITIALIZING` → `INITIALIZED` → `CALLING` → `COMPLETE`
- ✅ Fixed request ID management (initRequestId = 1, toolRequestId = 2)

### Fix C: Initialized Notification
- ✅ Now sends `notifications/initialized` AFTER receiving initialize response (was sent before)
- ✅ This is critical for MCP protocol compliance

### Fix D: Environment & Shell
- ✅ Set `shell: true` for npx to work correctly
- ✅ Improved environment variable logging

### Fix E: Enhanced Error Logging
- ✅ All stderr output is logged (filters npm noise)
- ✅ This will catch Gemini API errors (401, 429, etc.)
- ✅ Enhanced logging for every JSON-RPC message received

### Fix F: Cleanup
- ✅ Removed unused `processStdioBuffer` method
- ✅ Proper cleanup of readline interface on completion/error

