# Quick Deployment Guide

## Backend (GCP Cloud Run) - 5 Minutes

```powershell
# 1. Navigate to backend
cd backend

# 2. Create .env file (copy from env.example.txt and fill in values)
#    Important: Set CORS_ORIGIN to your Vercel URL after frontend deployment

# 3. Deploy
.\deploy.ps1

# 4. Copy the service URL from output (e.g., https://mcp-registry-backend-554655392699.us-central1.run.app)
```

## Frontend (Vercel) - 3 Minutes

### Option A: Vercel CLI (Fastest)
```bash
# From project root
npm i -g vercel
vercel login
vercel --prod
```

### Option B: Vercel Dashboard
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Framework: Next.js (auto-detected)
4. Root Directory: `.` (leave as default)
5. Build Settings: Auto-detected
6. Click "Deploy"

## Configure Connection

After both are deployed:

### 1. Get your URLs
- Backend URL: From Cloud Run deployment output
- Frontend URL: From Vercel dashboard

### 2. Set Frontend Environment Variable
In Vercel Dashboard → Project → Settings → Environment Variables:
```
NEXT_PUBLIC_API_URL = https://your-backend-url.run.app
```

### 3. Update Backend CORS
```powershell
cd backend
.\deploy.ps1 -SetEnvVars
# Update CORS_ORIGIN in .env to your Vercel URL first
```

Or manually:
```powershell
gcloud run services update mcp-registry-backend `
    --region us-central1 `
    --update-env-vars CORS_ORIGIN="https://your-app.vercel.app"
```

## Verify

1. Visit your Vercel URL
2. Open browser console (F12)
3. Check for: `[API Client] Using backend URL: ...`
4. Verify it matches your Cloud Run URL

## Troubleshooting

**Frontend can't connect:**
- Check `NEXT_PUBLIC_API_URL` is set in Vercel
- Check backend URL is correct (no trailing slash)
- Verify backend is running: `curl https://your-backend-url/health`

**CORS errors:**
- Update `CORS_ORIGIN` in backend to match your Vercel domain exactly
- Redeploy backend with: `.\deploy.ps1 -SetEnvVars`

**Need help?** See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

