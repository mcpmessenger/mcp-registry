# Vercel Deployment via GitHub

This guide will help you deploy to **Vercel via GitHub** and prevent double deployment on AWS Amplify.

## Backend URL
Your backend is deployed at: **https://mcp-registry-backend-554655392699.us-central1.run.app**

## Step 1: Prevent Amplify Auto-Deployment

To avoid deploying to both Amplify and Vercel, you have two options:

### Option A: Rename amplify.yml (Recommended if using Vercel only)

If you want to use **only Vercel**, rename the file so Amplify won't detect it:

```powershell
# From project root
Rename-Item -Path amplify.yml -NewName amplify.yml.disabled
```

Or if you want to keep it for reference:
```powershell
Move-Item -Path amplify.yml -Destination docs/amplify.yml.backup
```

### Option B: Disable Amplify App (If app already exists)

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Find your app
3. Go to **App settings** → **General**
4. Click **Delete app** or disable automatic deployments

## Step 2: Set Up Vercel with GitHub

### Via Vercel Dashboard (Recommended)

1. **Go to Vercel**: https://vercel.com/new
2. **Sign in** with your GitHub account (or connect if not connected)
3. **Import Repository**:
   - Find your `mcp-registry` repository
   - Click **Import**
4. **Configure Project**:
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: `.` (default, leave as is)
   - **Build Command**: `npm run build` (or `pnpm build` if using pnpm)
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `npm install` (or `pnpm install`)
5. **Environment Variables**:
   - Click **Environment Variables**
   - Add:
     - **Key**: `NEXT_PUBLIC_API_URL`
     - **Value**: `https://mcp-registry-backend-554655392699.us-central1.run.app`
     - **Environment**: Production, Preview, Development (select all)
6. **Deploy**: Click **Deploy**

After first deployment, Vercel will:
- ✅ Automatically deploy on every push to `main` branch
- ✅ Create preview deployments for pull requests
- ✅ Link with your GitHub repository

## Step 3: Verify Deployment

1. Wait for deployment to complete (usually 2-3 minutes)
2. Vercel will provide you with a URL like: `https://your-project-name.vercel.app`
3. Open the URL in your browser
4. Open browser console (F12) and check for:
   ```
   [API Client] Using backend URL: https://mcp-registry-backend-554655392699.us-central1.run.app
   ```

## Step 4: Update Backend CORS

Once you have your Vercel URL:

```powershell
cd backend

# Edit .env file - update CORS_ORIGIN to your Vercel URL
# CORS_ORIGIN="https://your-project-name.vercel.app"

# Update environment variables only (no rebuild needed)
.\deploy.ps1 -SetEnvVars
```

Or manually:
```powershell
gcloud run services update mcp-registry-backend `
    --region us-central1 `
    --update-env-vars CORS_ORIGIN="https://your-project-name.vercel.app"
```

## Step 5: Test Everything

1. Visit your Vercel URL
2. Test the application functionality
3. Check browser console for errors
4. Verify API calls are working

## Future Deployments

Once set up, every push to your `main` branch will automatically:
- ✅ Trigger Vercel deployment
- ✅ Build and deploy your frontend
- ✅ Create a new deployment

No manual steps needed!

## Troubleshooting

### Amplify still deploying?
- Make sure `amplify.yml` is renamed or removed
- Check AWS Amplify Console and disable/delete the app
- Verify no webhooks in GitHub settings point to Amplify

### Vercel not auto-deploying?
- Check Vercel Dashboard → Settings → Git
- Verify GitHub integration is connected
- Check GitHub repository webhooks (should include Vercel)

### CORS errors?
- Update `CORS_ORIGIN` in backend to match your Vercel domain exactly
- Redeploy backend: `.\deploy.ps1 -SetEnvVars`
- Clear browser cache

