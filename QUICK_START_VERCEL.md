# Quick Start: Deploy to Vercel via GitHub

## Current Setup
- ✅ Backend deployed: https://mcp-registry-backend-554655392699.us-central1.run.app
- ✅ `amplify.yml` disabled (renamed to prevent double deployment)
- ✅ `vercel.json` configured

## Deploy Now (5 minutes)

### 1. Go to Vercel
https://vercel.com/new

### 2. Import Your Repository
- Sign in with GitHub
- Find your `mcp-registry` repository
- Click **Import**

### 3. Configure Project
- **Framework**: Next.js (auto-detected)
- **Root Directory**: `.` (default)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

### 4. Add Environment Variable
Before clicking Deploy:
- Click **Environment Variables**
- Add:
  - **Key**: `NEXT_PUBLIC_API_URL`
  - **Value**: `https://mcp-registry-backend-554655392699.us-central1.run.app`
  - **Environments**: Select all (Production, Preview, Development)

### 5. Deploy
- Click **Deploy**
- Wait 2-3 minutes
- Get your Vercel URL (e.g., `https://your-app.vercel.app`)

### 6. Update Backend CORS
After you have your Vercel URL:

```powershell
cd backend
# Edit .env - update CORS_ORIGIN to your Vercel URL
# Then run:
.\deploy.ps1 -SetEnvVars
```

## Done! 🎉

Every push to `main` will now auto-deploy to Vercel.

