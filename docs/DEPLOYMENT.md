# Deployment Guide

This guide explains how to deploy the MCP Registry application:
- **Backend**: Google Cloud Run
- **Frontend**: Vercel

## Prerequisites

### For Backend (GCP Cloud Run)
- Google Cloud SDK (`gcloud`) installed and configured
- A GCP project with billing enabled
- Cloud Build API enabled
- Cloud Run API enabled
- Artifact Registry API enabled (for container images)

### For Frontend (Vercel)
- Vercel account (free tier works)
- Vercel CLI installed (optional, can use web interface)

## Backend Deployment (Google Cloud Run)

### 1. Initial Setup

```powershell
# Navigate to backend directory
cd backend

# Authenticate with Google Cloud
gcloud auth login

# Set your project
gcloud config set project 554655392699

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend/` directory based on `env.example.txt`:

```bash
# Database - Use Cloud SQL connection string or keep SQLite for testing
DATABASE_URL="postgresql://user:password@/database?host=/cloudsql/project:region:instance"

# Server
PORT=8080
NODE_ENV=production
CORS_ORIGIN="https://your-vercel-app.vercel.app"

# Google APIs (store in Secret Manager for production)
GOOGLE_GEMINI_API_KEY=your_gemini_key
GOOGLE_VISION_API_KEY=your_vision_key

# OpenAI (for Whisper transcription)
OPENAI_API_KEY=your_openai_key

# Kafka (optional - leave empty to disable)
KAFKA_BROKERS=
ENABLE_KAFKA=false

# Encryption keys
ENCRYPTION_SECRET=your_secret
ENCRYPTION_SALT=your_salt
```

**Important Security Notes:**
- For production, store sensitive values (API keys, secrets) in [Secret Manager](https://cloud.google.com/secret-manager)
- Format in `.env` for secrets: `GOOGLE_GEMINI_API_KEY=gemini-api-key:latest`
- The deployment script will automatically use Secret Manager if values end with `:latest`

### 3. Deploy Backend

```powershell
# From the backend/ directory
.\deploy.ps1
```

Or using bash:
```bash
cd backend
bash deploy.sh
```

The script will:
1. Build the Docker image
2. Push it to Artifact Registry
3. Deploy to Cloud Run with environment variables
4. Output the service URL

### 4. Update Environment Variables Only

If you only need to update environment variables without rebuilding:

```powershell
.\deploy.ps1 -SetEnvVars
```

### 5. Verify Deployment

```powershell
# Get the service URL
$url = (gcloud run services describe mcp-registry-backend --region us-central1 --format 'value(status.url)')

# Test health endpoint
curl "$url/health"
```

## Frontend Deployment (Vercel)

### Option 1: Deploy via Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
vercel

# For production deployment
vercel --prod
```

### Option 2: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your Git repository
4. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `.` (root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### 3. Configure Environment Variables in Vercel

In the Vercel dashboard:
1. Go to your project → Settings → Environment Variables
2. Add the following:

```
NEXT_PUBLIC_API_URL=https://mcp-registry-backend-554655392699.us-central1.run.app
```

**Replace with your actual Cloud Run service URL from step 5 above.**

### 4. Update Backend CORS

After deploying the frontend, update the backend CORS to allow your Vercel domain:

```powershell
cd backend

# Update CORS_ORIGIN in .env
# CORS_ORIGIN="https://your-app.vercel.app"

# Redeploy with updated env vars
.\deploy.ps1 -SetEnvVars
```

Or set it directly:
```powershell
gcloud run services update mcp-registry-backend `
    --region us-central1 `
    --update-env-vars CORS_ORIGIN="https://your-app.vercel.app"
```

### 5. Verify Frontend Deployment

1. Visit your Vercel deployment URL
2. Check browser console for API connection
3. Test the health endpoint via the frontend

## Post-Deployment Checklist

- [ ] Backend is accessible at Cloud Run URL
- [ ] Frontend is accessible at Vercel URL
- [ ] Frontend environment variable `NEXT_PUBLIC_API_URL` is set
- [ ] Backend `CORS_ORIGIN` includes your Vercel domain
- [ ] Health check endpoint responds: `https://your-backend-url/health`
- [ ] Database migrations have been run (if using PostgreSQL)
- [ ] API keys are stored securely (Secret Manager for GCP)
- [ ] SSL certificates are working (automatic for both platforms)

## Troubleshooting

### Backend Issues

**Build fails:**
- Check Dockerfile syntax
- Verify all dependencies in package.json
- Check Cloud Build logs: `gcloud builds list`

**Deployment fails:**
- Verify gcloud authentication: `gcloud auth list`
- Check Cloud Run quotas
- Review Cloud Run logs: `gcloud run services logs read mcp-registry-backend --region us-central1`

**CORS errors:**
- Verify `CORS_ORIGIN` environment variable matches your frontend URL exactly
- Check Cloud Run service logs for CORS error details

### Frontend Issues

**API connection fails:**
- Verify `NEXT_PUBLIC_API_URL` is set correctly in Vercel
- Check browser console for exact error
- Verify backend URL is accessible from browser
- Check CORS configuration in backend

**Build fails:**
- Check Vercel build logs
- Verify all dependencies in package.json
- Check for TypeScript errors (if not ignored)

## Continuous Deployment

Both platforms support automatic deployments:

- **Vercel**: Automatically deploys on push to main branch
- **Cloud Run**: Set up Cloud Build triggers for automatic deployments on push

## Cost Estimates

### Google Cloud Run
- **Free tier**: 2 million requests/month, 360,000 GB-seconds memory
- **Pricing**: Pay-per-use, scales to zero when idle
- Estimated cost: $5-20/month for moderate traffic

### Vercel
- **Free tier**: 100 GB bandwidth/month, unlimited builds
- **Pricing**: Free for hobby projects, Pro starts at $20/month
- Estimated cost: $0-20/month depending on traffic

## Security Best Practices

1. **Never commit `.env` files** - Use `.gitignore`
2. **Use Secret Manager** for sensitive values in production
3. **Enable authentication** on Cloud Run for internal services (optional)
4. **Set up monitoring** with Cloud Monitoring and Vercel Analytics
5. **Regularly update dependencies** and scan for vulnerabilities

## Support

For issues or questions:
- Check Cloud Run logs: `gcloud run services logs read mcp-registry-backend --region us-central1`
- Check Vercel logs in the dashboard
- Review this deployment guide
- Check backend and frontend logs in their respective platforms

