# CORS Fix - Ready to Deploy

## What I Fixed

1. ✅ **Fixed CORS callback** (`backend/src/server.ts`):
   - Changed from `callback(new Error(...))` to `callback(null, false)`
   - This prevents 500 errors on OPTIONS preflight requests
   - Now correctly returns 403 for denied origins

2. ✅ **Updated .env file** with correct CORS_ORIGIN:
   ```env
   CORS_ORIGIN="https://slashmcp.com,https://main.d2cddqmnkv63mg.amplifyapp.com,https://mcp-registry-sentilabs.vercel.app"
   ```

## Next Step: Deploy (Run in Admin Terminal)

**IMPORTANT**: You need to run this in an **admin PowerShell terminal** because of gcloud permission issues.

### Option 1: Use Deploy Script (Recommended)

```powershell
cd C:\Users\senti\OneDrive\Desktop\mcp-registry\backend
.\deploy.ps1
```

This will:
- Build the Docker image with the CORS fix
- Push to Artifact Registry  
- Deploy to Cloud Run
- Set all environment variables including CORS_ORIGIN

### Option 2: Update Environment Variable Only (Faster)

If you just want to update CORS_ORIGIN without rebuilding:

```powershell
cd C:\Users\senti\OneDrive\Desktop\mcp-registry\backend
.\deploy.ps1 -SetEnvVars
```

This only updates environment variables (no rebuild).

### Option 3: Manual gcloud Command (Admin Terminal)

```powershell
gcloud run services update mcp-registry-backend `
    --region us-central1 `
    --update-env-vars "CORS_ORIGIN=https://slashmcp.com,https://main.d2cddqmnkv63mg.amplifyapp.com,https://mcp-registry-sentilabs.vercel.app"
```

Then rebuild and redeploy with:
```powershell
cd backend
.\deploy.ps1
```

## After Deployment

1. Wait 1-2 minutes for the new revision to deploy
2. Visit your Amplify site: `https://main.d2cddqmnkv63mg.amplifyapp.com/registry`
3. Refresh the page
4. ✅ CORS error should be gone!
5. ✅ Backend should connect successfully

## Current CORS Configuration

- ✅ Production: `https://slashmcp.com`
- ✅ Amplify: `https://main.d2cddqmnkv63mg.amplifyapp.com`
- ✅ Vercel: `https://mcp-registry-sentilabs.vercel.app`

All three domains are now configured and ready to use after deployment!

