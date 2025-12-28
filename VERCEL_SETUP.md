# Vercel Frontend Deployment Guide

Your backend is deployed at: **https://mcp-registry-backend-554655392699.us-central1.run.app**

## Step 1: Deploy Frontend to Vercel

### Option A: Via Vercel CLI (Recommended)

```powershell
# From project root (make sure you're not in backend folder)
cd C:\Users\senti\OneDrive\Desktop\mcp-registry

# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel (if not already logged in)
vercel login

# Deploy to production
vercel --prod
```

Follow the prompts:
- **Set up and deploy?** → Yes
- **Which scope?** → Your Vercel account
- **Link to existing project?** → No (first time) or Yes (if already linked)
- **What's your project's name?** → mcp-registry (or your preferred name)
- **In which directory is your code located?** → `./` (current directory)

### Option B: Via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Git Repository"
3. Select your GitHub repository (or connect if not connected)
4. Configure project:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `.` (default)
   - **Build Command:** `npm run build` (or `pnpm build` if using pnpm)
   - **Output Directory:** `.next`
   - **Install Command:** `npm install` (or `pnpm install`)
5. Click "Deploy"

## Step 2: Set Environment Variable

After deployment completes, you need to set the backend URL:

### Via Vercel Dashboard:

1. Go to your project in Vercel Dashboard
2. Click **Settings** → **Environment Variables**
3. Click **Add New**
4. Enter:
   - **Key:** `NEXT_PUBLIC_API_URL`
   - **Value:** `https://mcp-registry-backend-554655392699.us-central1.run.app`
   - **Environment:** Select **Production** (and **Preview** if you want)
5. Click **Save**
6. **Redeploy** your application (Vercel may auto-redeploy, or trigger a new deployment)

### Via Vercel CLI:

```powershell
vercel env add NEXT_PUBLIC_API_URL production
# When prompted, enter: https://mcp-registry-backend-554655392699.us-central1.run.app
```

Then redeploy:
```powershell
vercel --prod
```

## Step 3: Get Your Vercel URL

After deployment, Vercel will provide you with:
- Production URL: `https://your-app-name.vercel.app`
- Or check the deployment page in Vercel dashboard

## Step 4: Update Backend CORS

Once you have your Vercel URL, update the backend to allow requests from it:

```powershell
cd backend

# Edit .env file and update CORS_ORIGIN to your Vercel URL
# CORS_ORIGIN="https://your-app-name.vercel.app"

# Update environment variables only (no rebuild)
.\deploy.ps1 -SetEnvVars
```

Or manually:
```powershell
gcloud run services update mcp-registry-backend `
    --region us-central1 `
    --update-env-vars CORS_ORIGIN="https://your-app-name.vercel.app"
```

## Step 5: Verify Everything Works

1. Visit your Vercel URL
2. Open browser console (F12)
3. Look for: `[API Client] Using backend URL: https://mcp-registry-backend-554655392699.us-central1.run.app`
4. Test the application functionality

## Troubleshooting

### Frontend can't connect to backend
- Verify `NEXT_PUBLIC_API_URL` is set in Vercel
- Check that you've redeployed after setting the env var
- Verify backend URL is correct (no trailing slash)

### CORS errors
- Make sure `CORS_ORIGIN` in backend matches your Vercel domain exactly
- Redeploy backend after updating CORS: `.\deploy.ps1 -SetEnvVars`

