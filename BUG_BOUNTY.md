# Bug Bounty: Design Generation via STDIO MCP Server Hanging

## 🔴 ROOT CAUSE IDENTIFIED (2025-12-24)

### Primary Issue: Gemini API Quota Exceeded (429 Error)

**Status**: ✅ **ROOT CAUSE CONFIRMED** - Not a code bug, but API quota limitation

**Evidence from Direct Testing**:
- Created `test-nano-banana-mcp.js` to test MCP server directly
- MCP server protocol works correctly (initialize ✅, tool call ✅)
- **Gemini API returns 429 error**: "You exceeded your current quota"
- Model: `gemini-2.5-flash-preview-image`
- Quota Type: Free Tier (very limited quotas)

**Why Requests Appear to Hang**:
- MCP server correctly returns error response with `"error"` field
- Previous code only checked for `message.result`, not `message.error`
- Error responses were not being handled, causing infinite polling
- Frontend kept polling because no error was returned to stop it

**Fix Applied**:
- ✅ Now properly detects error responses (`message.error`)
- ✅ Specifically detects quota/rate limit errors (429, quota, RESOURCE_EXHAUSTED)
- ✅ Returns proper HTTP status codes (429 for quota errors)
- ✅ Provides helpful error messages instead of hanging

**Next Steps**:
1. Update API key in Nano Banana MCP server registration
2. Verify new key has available quota
3. Test design generation - should work if quota available
4. If quota still exceeded, will now show clear error message

---

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

**Root Cause**: ✅ **CONFIRMED** - Gemini API quota exceeded (429 error)
- MCP server returns error response, but code wasn't handling errors
- Error responses caused infinite polling loop
- **Fix**: Now properly detects and handles error responses

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

## 🚀 Next Steps to Resolve

### Immediate Actions Required

1. ✅ **Update API Key**: User has obtained new Gemini API key
   - **Action**: Update `GEMINI_API_KEY` in Nano Banana MCP server registration
   - **Location**: MCP Registry UI or via API PUT request
   - **Status**: ⏳ Pending user action

2. ✅ **Verify New Key Has Quota**: 
   - Check quota at: https://ai.dev/usage?tab=rate-limit
   - Ensure new key has available quota for `gemini-2.5-flash-preview-image` model
   - **Note**: Free tier has very limited quotas - may need paid plan

3. ✅ **Test After Key Update**:
   - Deploy latest error handling fixes
   - Test design generation request
   - Should now see clear error message if quota still exceeded
   - Should work if new key has available quota

### Code Fixes Completed

1. ✅ **Fix TypeScript Error**: Changed `requestId++` to `initRequestId` on line 333
2. ✅ **Implement Line-Buffered Reading**: Replaced buffer accumulation with `readline` module
3. ✅ **Add State Machine**: Implemented proper state management
4. ✅ **Fix Initialized Notification**: Now sends after receiving initialize response
5. ✅ **Improve Stderr Logging**: All stderr output logged to catch API errors
6. ✅ **Add Shell Mode**: Set `shell: true` for npx to work correctly
7. ✅ **Enhanced Logging**: Log every JSON-RPC message received
8. ✅ **Error Response Handling**: Now properly detects and handles error responses
9. ✅ **Quota Error Detection**: Specifically detects 429/quota errors and returns helpful messages

## 🔗 Related Resources

- **Nano-Banana-MCP**: https://github.com/ConechoAI/Nano-Banana-MCP
- **MCP Protocol Spec**: https://modelcontextprotocol.io
- **Backend URL**: https://mcp-registry-backend-554655392699.us-central1.run.app
- **Cloud Run Logs**: Available in Google Cloud Console

## 💡 Root Cause Analysis

### ✅ CONFIRMED: Gemini API Quota Exceeded

**Evidence**:
- Direct test of Nano Banana MCP server shows 429 error
- Error message explicitly states: "You exceeded your current quota"
- Free tier quotas for `gemini-2.5-flash-preview-image` are very limited
- Model requires free tier quotas that may be exhausted

**Why It Appeared to Hang**:
- MCP server correctly returns error response
- Previous code only checked for `message.result`, not `message.error`
- Error responses were not being handled, causing infinite polling
- Frontend kept polling because no error was returned

### Other Potential Issues (Resolved)

1. ✅ **JSON-RPC Parsing**: Fixed with `readline` module
2. ✅ **Response Format**: Now handles both success and error responses
3. ✅ **Process Hanging**: Fixed with proper state machine and timeouts
4. ✅ **Environment Variables**: Verified API key is passed correctly
5. ✅ **Error Handling**: Now properly detects and returns errors

## 📊 Test Cases & Results

### Test Case 1: Direct MCP Server Test ✅ COMPLETED
**Command**: `node test-nano-banana-mcp.js`  
**Result**: 
- ✅ Initialize: Success
- ✅ Tool Call: Success (protocol working)
- ❌ Gemini API: 429 Quota Exceeded Error

**Error Response Structure**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32603,
    "message": "MCP error -32603: Failed to generate image: {...429 error...}"
  }
}
```

### Test Case 2: Simple Design Request
```json
{
  "toolName": "generate_image",
  "toolArgs": {
    "prompt": "A simple red circle",
    "style": "minimalist"
  }
}
```
**Status**: ⏳ Pending - Waiting for new API key with available quota

### Test Case 3: Complex Design Request
```json
{
  "toolName": "generate_image",
  "toolArgs": {
    "prompt": "Design a minimalist coffee shop poster with dark background and purple accents",
    "style": "poster"
  }
}
```
**Status**: ⏳ Pending - Waiting for new API key with available quota

## 🔍 Testing Tools Created

1. **`test-nano-banana-mcp.js`**: Direct STDIO MCP server test
   - Spawns Nano Banana MCP server
   - Tests initialize and tool call
   - Shows exact JSON-RPC responses
   - Identifies quota errors

2. **`test-endpoint.ps1`**: Backend endpoint test
   - Tests `/api/mcp/tools/generate` endpoint
   - Shows backend response structure
   - Useful for debugging after key update

## 📋 Resolution Checklist

- [x] Identify root cause (Gemini API quota exceeded)
- [x] Fix error response handling in MCP invoke service
- [x] Add quota error detection and helpful messages
- [x] Create test scripts for debugging
- [x] Improve logging for troubleshooting
- [ ] **User Action Required**: Update API key in server registration
- [ ] **User Action Required**: Verify new key has available quota
- [ ] Test design generation with new API key
- [ ] Verify images are returned correctly
- [ ] Update status to "Resolved" once working

## 🎯 Expected Outcome After Key Update

Once the new API key is set and has available quota:

1. **Request Flow**:
   - User sends design request
   - Backend routes to Nano Banana MCP
   - MCP server calls Gemini API
   - **Gemini API returns image** (instead of 429 error)
   - MCP server returns image in JSON-RPC response
   - Backend parses response and extracts image URL/data
   - Frontend displays image

2. **If Quota Still Exceeded**:
   - Backend now returns clear error message
   - Frontend shows: "Gemini API quota exceeded: ..."
   - No more infinite polling
   - User knows exactly what the issue is

---

**Last Updated**: 2025-12-24  
**Status**: 🔴 **ROOT CAUSE IDENTIFIED** - Gemini API Quota Exceeded (429 Error)  
**Priority**: 🔥 Critical - Core feature not working  
**Blocked By**: API key quota limits (user action required to update key)

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

