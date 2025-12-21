# Fix Frontend API URL on Vercel

## Problem

The deployed frontend is trying to connect to `http://localhost:3001` instead of the Cloud Run backend, causing connection errors.

## Solution

Set the `NEXT_PUBLIC_API_URL` environment variable in Vercel to point to your Cloud Run backend.

## Steps

### 1. Get Your Backend URL

Your Cloud Run backend URL is:
```
https://mcp-registry-backend-554655392699.us-central1.run.app
```

### 2. Update Vercel Environment Variable

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Find your project: `v0-logo-design` (or your project name)

2. **Navigate to Settings:**
   - Click on your project
   - Go to **Settings** tab
   - Click **Environment Variables** in the left sidebar

3. **Add/Update Environment Variable:**
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://mcp-registry-backend-554655392699.us-central1.run.app`
   - **Environment**: Select all (Production, Preview, Development)
   - Click **Save**

4. **Redeploy:**
   - Vercel will automatically trigger a new deployment
   - Or manually trigger: Go to **Deployments** tab → Click **Redeploy** on the latest deployment

### 3. Verify the Fix

After deployment completes:

1. **Visit your Vercel site:**
   - Should load without connection errors
   - Should show MCP servers (Playwright + LangChain)

2. **Check Browser Console:**
   - Open DevTools (F12)
   - Network tab should show requests to:
     - `https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers`
   - NOT `http://localhost:3001`

## Quick Command (Alternative)

If you have Vercel CLI installed:

```powershell
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login
vercel login

# Set environment variable
vercel env add NEXT_PUBLIC_API_URL production
# When prompted, enter: https://mcp-registry-backend-554655392699.us-central1.run.app

# Redeploy
vercel --prod
```

## Step 4: Update Backend CORS (Important!)

The backend also needs to allow requests from your Vercel frontend. Update the Cloud Run service:

```powershell
# Update CORS_ORIGIN environment variable
gcloud run services update mcp-registry-backend `
  --region us-central1 `
  --set-env-vars CORS_ORIGIN=https://v0-logo-design-ashen-mu.vercel.app
```

**Or** if your Vercel URL is different, replace it with your actual URL.

**Note:** The CORS middleware also allows `*.vercel.app` domains, but it's better to be explicit.

## Troubleshooting

### Still seeing localhost errors?

1. **Clear browser cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or use Incognito/Private mode

2. **Check environment variable:**
   - In Vercel Dashboard → Settings → Environment Variables
   - Verify `NEXT_PUBLIC_API_URL` is set correctly
   - Make sure it's enabled for **Production** environment

3. **Check deployment logs:**
   - In Vercel Dashboard → Deployments → Click latest deployment
   - Check Build Logs for any errors
   - Verify the environment variable is being used

4. **Verify backend is accessible:**
   ```powershell
   $BACKEND_URL = "https://mcp-registry-backend-554655392699.us-central1.run.app"
   Invoke-RestMethod -Uri "$BACKEND_URL/health"
   Invoke-RestMethod -Uri "$BACKEND_URL/v0.1/servers"
   ```

5. **Check CORS errors:**
   - Open browser DevTools (F12) → Console
   - Look for CORS errors like "Access to fetch at ... has been blocked by CORS policy"
   - If you see CORS errors, make sure you updated `CORS_ORIGIN` in Cloud Run (Step 4 above)

## Summary

| Step | Action | Result |
|------|--------|--------|
| 1 | Set `NEXT_PUBLIC_API_URL` in Vercel | Environment variable configured |
| 2 | Redeploy (automatic or manual) | New build with correct API URL |
| 3 | Test deployed site | Frontend connects to Cloud Run backend ✅ |

## Expected Result

After fixing:
- ✅ Frontend loads without errors
- ✅ MCP servers are displayed (Playwright + LangChain)
- ✅ Can invoke tools and interact with agents
- ✅ Network requests go to Cloud Run backend, not localhost
