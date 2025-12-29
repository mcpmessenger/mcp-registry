# Step-by-Step Deployment Guide

## Current Status
- ✅ gcloud CLI installed and working
- ✅ You're signed in to gcloud
- ⚠️ Need to verify project and enable APIs

## Step 1: Verify GCP Project Setup (2 minutes)

Open PowerShell as Administrator and run:

```powershell
# Check current project
gcloud config get-value project

# If needed, set your project (replace with your project ID)
gcloud config set project 554655392699

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

## Step 2: Update Backend .env for Production (2 minutes)

Edit `backend/.env` file and make these changes:

```env
# Change PORT
PORT=8080

# Change NODE_ENV
NODE_ENV=production

# Change CORS_ORIGIN (use placeholder for now, update after Vercel deployment)
CORS_ORIGIN="https://your-app.vercel.app"

# Disable Kafka (unless you have Kafka infrastructure)
ENABLE_KAFKA=false

# Keep DATABASE_URL as-is (deploy script will skip file: paths)
# DATABASE_URL="file:./dev.db"

# Keep all your API keys as they are:
# GOOGLE_GEMINI_API_KEY=...
# GOOGLE_VISION_API_KEY=...
# OPENAI_API_KEY=...
# ENCRYPTION_SECRET=...
# ENCRYPTION_SALT=...
```

**Important:** The deploy script will automatically skip `DATABASE_URL` if it starts with `file:`, so you can set up Cloud SQL later or use SQLite for now.

## Step 3: Deploy Backend to Cloud Run (5-10 minutes)

```powershell
# Navigate to backend directory
cd backend

# Deploy (this will build Docker image, push to Artifact Registry, and deploy to Cloud Run)
.\deploy.ps1
```

The script will:
1. Build Docker image
2. Push to Artifact Registry
3. Deploy to Cloud Run
4. Output the service URL (e.g., `https://mcp-registry-backend-554655392699.us-central1.run.app`)

**📝 Copy the service URL from the output!** You'll need it for the frontend.

## Step 4: Verify Backend Deployment (1 minute)

```powershell
# Test health endpoint
curl https://your-backend-url.run.app/health
```

Should return a successful response.

## Step 5: Deploy Frontend to Vercel (5 minutes)

### Option A: Via Vercel CLI (Recommended)

```powershell
# From project root (not backend folder)
cd ..

# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

### Option B: Via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Framework: Next.js (auto-detected)
4. Root Directory: `.` (default)
5. Build Settings: Auto-detected
6. Click "Deploy"

## Step 6: Configure Frontend Environment Variable (2 minutes)

After Vercel deployment completes:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add new variable:
   - **Key:** `NEXT_PUBLIC_API_URL`
   - **Value:** Your Cloud Run backend URL (from Step 3)
   - **Environment:** Production (and Preview if desired)

Example:
```
NEXT_PUBLIC_API_URL=https://mcp-registry-backend-554655392699.us-central1.run.app
```

3. **Redeploy** your frontend (Vercel will auto-redeploy on env var changes, or trigger a new deployment)

## Step 7: Update Backend CORS (2 minutes)

After you have your Vercel URL (e.g., `https://your-app.vercel.app`):

```powershell
# Navigate to backend
cd backend

# Update .env file - change CORS_ORIGIN to your actual Vercel URL
# CORS_ORIGIN="https://your-app.vercel.app"

# Update environment variables only (no rebuild needed)
.\deploy.ps1 -SetEnvVars
```

Or manually:
```powershell
gcloud run services update mcp-registry-backend `
    --region us-central1 `
    --update-env-vars CORS_ORIGIN="https://your-app.vercel.app"
```

## Step 8: Verify Everything Works (2 minutes)

1. Visit your Vercel URL
2. Open browser console (F12)
3. Check for: `[API Client] Using backend URL: ...` (should match your Cloud Run URL)
4. Test the application functionality

## Troubleshooting

### Backend won't start
- Check Cloud Run logs: `gcloud run services logs read mcp-registry-backend --region us-central1`
- Verify environment variables are set correctly
- Check that DATABASE_URL is handled (deploy script skips file: paths)

### Frontend can't connect to backend
- Verify `NEXT_PUBLIC_API_URL` is set in Vercel
- Check backend URL is correct (no trailing slash)
- Test backend directly: `curl https://your-backend-url/health`
- Check CORS configuration matches your Vercel domain exactly

### CORS errors
- Update `CORS_ORIGIN` in backend `.env` to match your Vercel domain exactly
- Redeploy backend: `.\deploy.ps1 -SetEnvVars`
- Clear browser cache and try again

## Next Steps (Optional)

- **Set up Cloud SQL** for production database (if needed)
- **Set up Secret Manager** for API keys (more secure)
- **Configure custom domain** in Vercel
- **Set up monitoring** and alerts

