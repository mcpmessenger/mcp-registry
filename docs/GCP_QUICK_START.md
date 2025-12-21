# GCP Quick Start - Backend Deployment

Quick reference for deploying the backend to GCP Cloud Run.

## 🚀 One-Command Setup (After Initial Config)

```powershell
.\scripts\deploy-gcp.ps1
```

## 📋 Initial Setup (One-Time)

### 1. Install gcloud CLI

```powershell
# Download from: https://cloud.google.com/sdk/docs/install
# Or use Chocolatey:
choco install gcloudsdk
```

### 2. Login and Set Project

```powershell
gcloud auth login
gcloud config set project mcp-registry-prod
```

### 3. Enable APIs

```powershell
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 4. Create Database

```powershell
gcloud sql instances create mcp-registry-db `
  --database-version=POSTGRES_15 `
  --tier=db-f1-micro `
  --region=us-central1 `
  --root-password=YOUR_SECURE_PASSWORD

gcloud sql databases create mcp_registry --instance=mcp-registry-db
```

### 5. Set Up Secrets

```powershell
.\scripts\setup-gcp-secrets.ps1
```

This will prompt you for:
- Google Gemini API Key
- Google Vision API Key (optional)
- OpenAI API Key (optional)
- Encryption Secret (generate with: `openssl rand -hex 32`)
- Encryption Salt (generate with: `openssl rand -hex 16`)
- Database Password

## 🚀 Deploy

```powershell
.\scripts\deploy-gcp.ps1 -FrontendUrl "https://your-app.vercel.app"
```

## 🔄 Run Migrations

After first deployment:

```powershell
$PROJECT_ID = "mcp-registry-prod"
$REGION = "us-central1"

# Create migration job
gcloud run jobs create migrate-db `
  --image gcr.io/$PROJECT_ID/mcp-registry-backend `
  --region $REGION `
  --add-cloudsql-instances $(gcloud sql instances describe mcp-registry-db --format="value(connectionName)") `
  --set-env-vars "NODE_ENV=production" `
  --set-secrets "GOOGLE_GEMINI_API_KEY=google-gemini-api-key:latest" `
  --set-env-vars "DATABASE_URL=postgresql://postgres:$(gcloud secrets versions access latest --secret=db-password)@/mcp_registry?host=/cloudsql/$(gcloud sql instances describe mcp-registry-db --format='value(connectionName)')" `
  --command npm `
  --args "run,migrate:deploy"

# Execute migration
gcloud run jobs execute migrate-db --region $REGION
```

## 🔗 Update Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add/Update: `NEXT_PUBLIC_API_URL` = `https://mcp-registry-backend-xxxxx.run.app`
3. Redeploy frontend

## ✅ Verify

```powershell
$SERVICE_URL = gcloud run services describe mcp-registry-backend --platform managed --region us-central1 --format="value(status.url)"
curl $SERVICE_URL/health
curl $SERVICE_URL/v0.1/servers
```

## 📊 View Logs

```powershell
gcloud run services logs read mcp-registry-backend --region us-central1 --follow
```

## 💰 Cost

- **Cloud Run**: Free tier (2M requests/month), then ~$0.40 per million
- **Cloud SQL** (db-f1-micro): ~$7.67/month
- **Total**: ~$10-20/month for low traffic

## 🔧 Troubleshooting

### Service won't start
```powershell
# Check logs
gcloud run services logs read mcp-registry-backend --region us-central1 --limit 50
```

### Database connection issues
```powershell
# Verify Cloud SQL instance
gcloud sql instances describe mcp-registry-db

# Check if Cloud SQL connection is added
gcloud run services describe mcp-registry-backend --region us-central1 --format="yaml(spec.template.spec.containers[0].env)"
```

### Secrets not found
```powershell
# List secrets
gcloud secrets list

# Verify secret exists
gcloud secrets describe google-gemini-api-key
```
