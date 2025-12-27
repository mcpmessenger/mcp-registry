# Troubleshooting Google Maps API 403 Errors

## Quick Diagnosis Steps

### Step 1: Check if API Key is Configured

Visit the debug endpoint to verify the server configuration:
```
GET http://localhost:3001/v0.1/debug/server/com.google/maps-mcp
```

**Expected Response:**
```json
{
  "success": true,
  "server": {
    "serverId": "com.google/maps-mcp",
    "name": "Google Maps MCP (Grounding Lite)",
    "endpoint": "https://mapstools.googleapis.com/mcp",
    "hasMetadata": true,
    "hasHttpHeaders": true,
    "httpHeaders": ["X-Goog-Api-Key"],
    "httpHeadersPreview": {
      "X-Goog-Api-Key": "AIzaSyCXXX..."
    }
  }
}
```

**If `hasHttpHeaders` is `false`**: The API key is not configured.

### Step 2: Configure API Key

1. Go to `/registry` page
2. Find "Google Maps MCP (Grounding Lite)"
3. Click **Edit**
4. In **HTTP Headers (JSON)** field, paste:
   ```json
   {
     "X-Goog-Api-Key": "YOUR_API_KEY_HERE"
   }
   ```
5. Click **Save**

### Step 3: Verify Backend Logs

When a tool is invoked, you should see:
```
[HTTP] Invoking search_places on com.google/maps-mcp at https://mapstools.googleapis.com/mcp
[HTTP] Headers: Content-Type, X-Goog-Api-Key
[HTTP] Google Maps API key present: AIzaSyCXXX...
```

If you **don't** see "Google Maps API key present", the headers aren't being extracted correctly.

### Step 4: Restart Backend

After making changes, restart the backend:
```bash
cd backend
npm start
```

Or if using a process manager:
```bash
# Kill and restart
pkill -f "node.*server"
cd backend && npm start
```

## Common Issues

### Issue: API Key Not Being Passed

**Symptoms:**
- 403 PERMISSION_DENIED errors
- Debug endpoint shows `hasHttpHeaders: false`
- Backend logs don't show "Google Maps API key present"

**Solution:**
1. Verify API key is saved in registry (check debug endpoint)
2. Restart backend server
3. Verify metadata is being parsed correctly

### Issue: Invalid API Key

**Symptoms:**
- 403 errors even with API key configured
- Google Cloud Console shows invalid key errors

**Solution:**
1. Generate a new API key in Google Cloud Console
2. Ensure **Maps Grounding Lite API** is enabled
3. Update the registry with new key
4. Restart backend

### Issue: API Restrictions

**Symptoms:**
- Works locally but fails in production
- Different error codes (429, 403 with specific restrictions)

**Solution:**
1. Check API key restrictions in Google Cloud Console
2. Add your production IP to allowed IPs (if restricted)
3. Or remove IP restrictions for testing
4. Verify API key has access to Maps Grounding Lite API

## Testing the Fix

1. **Check debug endpoint:**
   ```bash
   curl http://localhost:3001/v0.1/debug/server/com.google/maps-mcp
   ```

2. **Test tool invocation:**
   - Go to Chat page
   - Type: "Find restaurants near Times Square"
   - Should work without 403 errors

3. **Check backend logs:**
   - Should see "[HTTP] Google Maps API key present"
   - Should see successful API calls

## Still Having Issues?

1. Verify Google Cloud Console:
   - API key is active
   - Maps Grounding Lite API is enabled
   - Billing is enabled (if required)

2. Test API key directly:
   ```bash
   curl -X POST https://mapstools.googleapis.com/mcp \
     -H "Content-Type: application/json" \
     -H "X-Goog-Api-Key: YOUR_KEY" \
     -d '{
       "jsonrpc": "2.0",
       "id": 1,
       "method": "tools/call",
       "params": {
         "name": "search_places",
         "arguments": {
           "text_query": "restaurants in New York"
         }
       }
     }'
   ```

3. Check backend code is updated:
   - Verify `mcp-invoke.service.ts` has the HTTP headers extraction code
   - Check that metadata.httpHeaders is being read

4. Review logs:
   - Backend console should show header information
   - Network tab in browser DevTools shows request headers

