# Integration Test Plan

## Step 1: Backend Testing ✅

### Test Results:
- ✅ Health check working
- ✅ Registry API working (returns 1 server)
- ✅ Get specific server working (with URL encoding)
- ⚠️ SVG generation needs debugging

## Step 2: Frontend Integration ✅

### Changes Made:
- ✅ Created `lib/api.ts` - API client library
- ✅ Created `lib/server-utils.ts` - Data transformation utilities
- ✅ Updated `app/page.tsx` - Now fetches from backend API
- ✅ Added loading and error states

## Step 3: Testing Checklist

### Backend Tests:
```powershell
# 1. Health check
Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing

# 2. List servers
Invoke-WebRequest -Uri "http://localhost:3001/v0/servers" -UseBasicParsing

# 3. Get specific server
Invoke-WebRequest -Uri "http://localhost:3001/v0/servers/io.github.mcpmessenger%2Fmcp-server" -UseBasicParsing
```

### Frontend Tests:
1. Start frontend: `cd . && npm run dev`
2. Navigate to `http://localhost:3000`
3. Verify:
   - ✅ Registry page loads
   - ✅ Shows 1 server from backend
   - ✅ Server details display correctly
   - ✅ No console errors

### SVG Generation Test:
```powershell
$body = @{
    description = "minimalist icon, blue palette"
    style = "modern"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3001/api/mcp/tools/generate" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

Check server logs for:
- API key status on startup
- Error details if generation fails

## Next Steps After Testing:

1. If SVG generation fails:
   - Check server logs for API key errors
   - Verify API key is in .env file
   - Test API key directly with Google

2. If frontend doesn't load servers:
   - Check browser console for CORS errors
   - Verify backend is running
   - Check network tab for failed requests

3. If everything works:
   - Move to chat integration
   - Add progress streaming
   - Test full workflow
