# Fixing Frontend Connection to Cloud Run Backend

## Problem

The deployed frontend on Vercel is trying to connect to `http://localhost:3001` instead of the Cloud Run backend URL `https://mcp-registry-backend-554655392699.us-central1.run.app`.

## Root Cause

Next.js embeds `NEXT_PUBLIC_*` environment variables into the client-side bundle **at build time**. If the environment variable is not set correctly in Vercel, or if the build was cached before the variable was set, the frontend will use the wrong URL.

## Solution Steps

### Option 1: Set Environment Variable in Vercel (Recommended)

1. **Go to Vercel Dashboard:**
   - Navigate to your project: https://vercel.com/dashboard
   - Select your `mcp-registry` project

2. **Open Settings → Environment Variables:**
   - Click on "Settings" tab
   - Click on "Environment Variables" in the sidebar

3. **Add the Environment Variable:**
   - **Key:** `NEXT_PUBLIC_API_URL`
   - **Value:** `https://mcp-registry-backend-554655392699.us-central1.run.app`
   - **Environment:** Select all (Production, Preview, Development)
   - Click "Save"

4. **Redeploy the Application:**
   - Go to the "Deployments" tab
   - Click the "..." menu on the latest deployment
   - Click "Redeploy"
   - **OR** push a new commit to trigger a rebuild

### Option 2: Verify the Code Fallback (Already Implemented)

The code in `lib/api.ts` has been updated to:
- Use `NEXT_PUBLIC_API_URL` if explicitly set
- Fall back to the production Cloud Run URL when `NODE_ENV=production` or `VERCEL=1`
- Only use `http://localhost:3001` in local development

This means even without setting the environment variable, the production build should use the correct URL. However, **explicitly setting the variable is recommended** for clarity and to allow overrides.

### Option 3: Force Clear Build Cache

If the environment variable is set but still not working:

1. **Clear Vercel Build Cache:**
   - Go to Vercel Dashboard → Your Project → Settings
   - Scroll to "Build & Development Settings"
   - Click "Clear Build Cache"
   - Redeploy

2. **Or trigger a clean rebuild:**
   ```bash
   # Make a small change to trigger rebuild
   git commit --allow-empty -m "Trigger Vercel rebuild"
   git push
   ```

## Verification Steps

After redeploying:

1. **Check the deployed site:**
   - Open your Vercel deployment URL
   - Open browser DevTools (F12)
   - Go to Network tab
   - Refresh the page
   - Look for requests to `/servers` or `/v0.1/servers`
   - The request should go to `https://mcp-registry-backend-554655392699.us-central1.run.app`, NOT `http://localhost:3001`

2. **Check Console:**
   - In DevTools Console, look for any CORS errors
   - The error message should change from "Cannot connect to backend" to either success or a different error (like CORS if backend CORS_ORIGIN is wrong)

3. **Test the Backend Directly:**
   ```powershell
   curl https://mcp-registry-backend-554655392699.us-central1.run.app/health
   curl https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers
   ```

## Troubleshooting

### Still seeing localhost:3001?

1. **Check Vercel Environment Variables:**
   - Verify `NEXT_PUBLIC_API_URL` is set correctly
   - Make sure it's set for the right environment (Production/Preview/Development)

2. **Check Build Logs:**
   - In Vercel Dashboard → Deployments → Latest deployment
   - Click "View Build Logs"
   - Look for any warnings about environment variables

3. **Hard Refresh Browser:**
   - The browser may have cached the old JavaScript bundle
   - Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac) to force refresh

4. **Check Network Tab:**
   - In DevTools → Network tab
   - Look at the actual request URL
   - If it shows localhost, the build is using the wrong URL

### CORS Errors?

If you see CORS errors after fixing the URL:

1. **Verify Backend CORS_ORIGIN:**
   ```powershell
   gcloud run services describe mcp-registry-backend --region us-central1 --format="value(spec.template.spec.containers[0].env)"
   ```
   Look for `CORS_ORIGIN` and ensure it matches your Vercel domain

2. **Update Backend CORS if needed:**
   The backend should have:
   ```
   CORS_ORIGIN=https://v0-logo-design-ashen-mu.vercel.app
   ```
   Or your actual Vercel deployment URL

## Quick Reference

**Backend URL:** `https://mcp-registry-backend-554655392699.us-central1.run.app`

**Vercel Environment Variable:**
```
NEXT_PUBLIC_API_URL=https://mcp-registry-backend-554655392699.us-central1.run.app
```

**Backend Health Check:**
```powershell
curl https://mcp-registry-backend-554655392699.us-central1.run.app/health
```

**Backend API Test:**
```powershell
curl https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers
```
