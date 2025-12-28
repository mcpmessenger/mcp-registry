# AWS Amplify Deployment Guide

Your domain `slashmcp.com` is hosted on AWS Amplify, so we'll deploy the frontend there.

## Backend URL
Your backend is deployed at: **https://mcp-registry-backend-554655392699.us-central1.run.app**

## Current Setup
- ✅ Backend deployed to Cloud Run
- ✅ `amplify.yml` configured for Next.js with pnpm
- ✅ Domain: slashmcp.com

## Step 1: Configure Amplify App

### If App Already Exists:

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Select your app (should be connected to your GitHub repo)
3. Go to **App settings** → **Environment variables**
4. Add/Update:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://mcp-registry-backend-554655392699.us-central1.run.app`
   - **Environment**: Production (and other environments if needed)
5. Save and redeploy

### If Creating New App:

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click **New app** → **Host web app**
3. Connect your GitHub repository
4. Configure:
   - **Branch**: `main` (or your production branch)
   - Amplify will auto-detect Next.js from `package.json`
   - Build settings should auto-detect from `amplify.yml`
5. **Environment Variables** (before first deploy):
   - Click **Advanced settings**
   - Add:
     - **Key**: `NEXT_PUBLIC_API_URL`
     - **Value**: `https://mcp-registry-backend-554655392699.us-central1.run.app`
6. Review and **Save and deploy**

## Step 2: Verify Build Settings

Your `amplify.yml` is configured with:
- **Package Manager**: pnpm
- **Build Command**: `pnpm run build`
- **Output Directory**: `.next`

Amplify should auto-detect these settings. If needed, verify in:
**App settings** → **Build settings** → **amplify.yml**

## Step 3: Configure Custom Domain (if not already done)

If `slashmcp.com` is not yet connected:

1. Go to **Domain management** in Amplify Console
2. Click **Add domain**
3. Enter: `slashmcp.com`
4. Follow DNS configuration instructions
5. Amplify will provide DNS records to add to your domain registrar

## Step 4: Update Backend CORS

After Amplify deployment completes and you have your domain:

```powershell
cd backend

# Edit .env file - update CORS_ORIGIN
# CORS_ORIGIN="https://slashmcp.com"

# Update environment variables only (no rebuild needed)
.\deploy.ps1 -SetEnvVars
```

Or manually:
```powershell
gcloud run services update mcp-registry-backend `
    --region us-central1 `
    --update-env-vars CORS_ORIGIN="https://slashmcp.com"
```

**Important**: If Amplify adds a `www` subdomain or you use both, you may need:
```powershell
# Allow both with and without www
CORS_ORIGIN="https://slashmcp.com,https://www.slashmcp.com"
```

## Step 5: Verify Deployment

1. Wait for Amplify build to complete (check build logs)
2. Visit `https://slashmcp.com`
3. Open browser console (F12)
4. Check for: `[API Client] Using backend URL: https://mcp-registry-backend-554655392699.us-central1.run.app`
5. Test application functionality

## Future Deployments

Every push to your `main` branch will automatically:
- ✅ Trigger Amplify build
- ✅ Build and deploy your frontend
- ✅ Deploy to `slashmcp.com`

## Troubleshooting

### Build Fails
- Check Amplify build logs in console
- Verify Node.js version is compatible (Next.js 16 requires Node 18+)
- Check that pnpm is being used (as configured in `amplify.yml`)
- Verify all dependencies in `package.json`

### API Connection Issues
- Verify `NEXT_PUBLIC_API_URL` is set correctly in Amplify environment variables
- Check backend CORS settings allow `https://slashmcp.com`
- Test backend directly: `curl https://mcp-registry-backend-554655392699.us-central1.run.app/health`
- Check browser console for exact error messages

### CORS Errors
- Update `CORS_ORIGIN` in backend to match your domain exactly
- Include both `https://slashmcp.com` and `https://www.slashmcp.com` if both are used
- Redeploy backend: `.\deploy.ps1 -SetEnvVars`
- Clear browser cache

### Domain Issues
- Verify DNS records are correct in Amplify Domain management
- Check domain propagation: https://dnschecker.org
- Ensure SSL certificate is provisioned (Amplify handles this automatically)

