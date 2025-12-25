# Next Steps Checklist

## ✅ Completed
- [x] Fixed job ID issue (removed unnecessary job IDs for synchronous results)
- [x] Updated error handling for quota errors
- [x] Committed changes to git

## 🚀 Immediate Next Steps

### 1. Deploy Backend Changes to Cloud Run

The job ID fix needs to be deployed. Use **Google Cloud Shell** (recommended) or your local terminal:

#### Option A: Google Cloud Shell (Recommended)

1. **Open Cloud Shell**: https://shell.cloud.google.com
2. **Navigate to backend directory**:
   ```bash
   cd ~/mcp-registry/backend
   ```
3. **Pull latest changes**:
   ```bash
   git pull
   ```
4. **Build and deploy**:
   ```bash
   # Copy Dockerfile
   cp Dockerfile.debian Dockerfile
   
   # Build and push to Artifact Registry
   gcloud builds submit --tag us-central1-docker.pkg.dev/slashmcp/mcp-registry/mcp-registry-backend --region us-central1 .
   
   # Deploy to Cloud Run
   gcloud run deploy mcp-registry-backend \
     --image us-central1-docker.pkg.dev/slashmcp/mcp-registry/mcp-registry-backend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   
   # Clean up
   rm Dockerfile
   ```

#### Option B: Local Terminal (if gcloud is configured)

Same commands as above, but run from your local terminal in the `backend` directory.

**Expected time**: 5-10 minutes

---

### 2. Update Gemini API Key

You mentioned you got a new API key. Update it in the Nano Banana MCP server registration:

#### Option A: Via UI (Easiest)

1. Go to your MCP Registry page
2. Find "Nano Banana MCP" in the list
3. Click "Edit"
4. Find the "Environment Variables" or "Credentials" field
5. Update `GEMINI_API_KEY` with your new key
6. Save

#### Option B: Via API (PowerShell)

```powershell
# Replace YOUR_NEW_API_KEY_HERE with your actual new API key
$newApiKey = "YOUR_NEW_API_KEY_HERE"

$body = @{
    env = @{
        GEMINI_API_KEY = $newApiKey
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers/com.mcp-registry%2Fnano-banana-mcp" `
    -Method PUT `
    -ContentType "application/json" `
    -Body $body
```

**Verify it worked**:
```powershell
$response = Invoke-RestMethod -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers/com.mcp-registry%2Fnano-banana-mcp" -Method GET
$response.env
```

You should see your new `GEMINI_API_KEY` in the output.

**Expected time**: 2 minutes

---

### 3. Verify API Key Has Quota

Check that your new API key has available quota:

1. **Check Quota**: https://ai.dev/usage?tab=rate-limit
2. **Verify Model Access**: Ensure `gemini-2.5-flash-preview-image` is available
3. **Note**: Free tier has very limited quotas - you may need a paid plan for image generation

**Expected time**: 1 minute

---

### 4. Test Design Generation

After deploying and updating the API key:

1. **Go to Chat page** in your app
2. **Select "Nano Banana MCP"** from the agent dropdown (or let it auto-route)
3. **Send a design request**: 
   - "make me an image of a kitty"
   - "Design a minimalist coffee shop poster with dark background and purple accents"
4. **Expected behavior**:
   - ✅ If quota available: Image returned immediately (no job ID)
   - ✅ If quota exceeded: Clear error message (no infinite polling)
   - ❌ If still hanging: Check Cloud Run logs for errors

**Expected time**: 1-2 minutes

---

## 🔍 Troubleshooting

### If Design Generation Still Hangs

1. **Check Cloud Run Logs**:
   - Go to: https://console.cloud.google.com/logs
   - Filter by service: `mcp-registry-backend`
   - Look for errors related to:
     - Gemini API (429, 401, etc.)
     - MCP server communication
     - Tool discovery

2. **Test MCP Server Directly**:
   ```bash
   cd backend
   node test-nano-banana-mcp.js
   ```
   This will show you the exact error from the Gemini API.

3. **Verify API Key**:
   - Check that the key is set correctly in the database
   - Try updating it again via API
   - Verify the key works at https://aistudio.google.com/apikey

### If You See "Job ID" for Synchronous Results

- The backend changes may not be deployed yet
- Check that the latest code is in Cloud Run
- Verify the deployment succeeded

### If Quota Still Exceeded

- Free tier quotas are very limited
- Consider upgrading to a paid plan
- Wait for quota reset (check at https://ai.dev/usage?tab=rate-limit)
- Try a different API key

---

## 📋 Summary Checklist

- [ ] Deploy backend changes to Cloud Run
- [ ] Update Gemini API key in Nano Banana MCP registration
- [ ] Verify API key has available quota
- [ ] Test design generation with a simple request
- [ ] Verify no job ID is created for synchronous results
- [ ] Check Cloud Run logs if issues persist

---

## 🎯 Success Criteria

After completing these steps, you should be able to:

1. ✅ Request a design and get an immediate result (no job ID)
2. ✅ See clear error messages if quota is exceeded (no infinite polling)
3. ✅ Have images displayed in the chat interface
4. ✅ No more "Job ID: job-xxx" messages for synchronous results

---

## 📚 Related Documents

- **Update API Key**: See `UPDATE_API_KEY.md`
- **Get API Key**: See `GET_GEMINI_API_KEY.md`
- **Bug Bounty**: See `BUG_BOUNTY.md` for full investigation details
- **Job ID Explanation**: See `JOB_ID_EXPLANATION.md` for why job IDs were removed

