# Quick Setup: AWS Amplify Deployment for slashmcp.com

## Backend URL
**https://mcp-registry-backend-554655392699.us-central1.run.app**

## Step 1: Configure Environment Variable in Amplify

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Select your app (the one connected to `slashmcp.com`)
3. Go to **App settings** → **Environment variables**
4. Click **Manage variables**
5. Add/Update:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://mcp-registry-backend-554655392699.us-central1.run.app`
   - **Environment**: Production (and Preview if you want)
6. Click **Save**

## Step 2: Trigger Deployment

If the app is already connected to GitHub:
- The next push to `main` will auto-deploy
- OR manually trigger: Click **Actions** → **Redeploy this version**

If not connected yet:
- Go to **App settings** → **General**
- Connect your GitHub repository if needed

## Step 3: Update Backend CORS

After Amplify deployment completes:

```powershell
cd backend

# Edit .env file - update CORS_ORIGIN
# CORS_ORIGIN="https://slashmcp.com"

# Update environment variables only (no rebuild needed)
.\deploy.ps1 -SetEnvVars
```

**Note**: If you also use `www.slashmcp.com`, include both:
```env
CORS_ORIGIN="https://slashmcp.com,https://www.slashmcp.com"
```

Or manually:
```powershell
gcloud run services update mcp-registry-backend `
    --region us-central1 `
    --update-env-vars CORS_ORIGIN="https://slashmcp.com"
```

## Step 4: Verify

1. Visit `https://slashmcp.com`
2. Open browser console (F12)
3. Look for: `[API Client] Using backend URL: https://mcp-registry-backend-554655392699.us-central1.run.app`
4. Test your application

## Done! 🎉

Your app is now deployed and connected to the backend!

