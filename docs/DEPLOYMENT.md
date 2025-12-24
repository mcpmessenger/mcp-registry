# Deployment Guide

Complete guide for deploying the MCP Registry platform to production.

## Deployment Architecture

```
┌─────────────────────────────────────────┐
│  Vercel (Frontend)                      │
│  https://mcp-registry.vercel.app       │
└────────────────────┬────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────┐
│  GCP Cloud Run (Backend API)            │
│  - Auto-scaling                         │
│  - Pay-per-use                          │
│  - HTTPS by default                     │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│  Cloud SQL (PostgreSQL)                 │
│  - Managed database                     │
│  - Automated backups                    │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│  Kafka/Cloud Pub/Sub (Event Bus)        │
│  - Message queue                        │
└─────────────────────────────────────────┘
```

## Frontend Deployment (Vercel)

The frontend is already configured for Vercel deployment.

### Deploy to Vercel

1. **Connect Repository**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Import your GitHub repository
   - Set root directory to `mcp-registry-main/`

2. **Configure Build Settings**:
   - Framework Preset: Next.js
   - Build Command: `pnpm build`
   - Output Directory: `.next`
   - Install Command: `pnpm install`

3. **Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.run.app
   ```

4. **Deploy**: Vercel will automatically deploy on every push to main.

See [Vercel Documentation](https://vercel.com/docs) for more details.

## Backend Deployment (GCP Cloud Run)

### Prerequisites

- GCP account with billing enabled
- `gcloud` CLI installed and configured
- Docker installed (for local testing)

### Step 1: Set Up GCP Project

```bash
# Login
gcloud auth login

# Create/select project
gcloud projects create mcp-registry-prod
gcloud config set project mcp-registry-prod

# Enable billing (required)
# Do this in GCP Console: https://console.cloud.google.com/billing
```

### Step 2: Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  pubsub.googleapis.com \
  containerregistry.googleapis.com
```

### Step 3: Create Cloud SQL Database

```bash
# Create PostgreSQL instance
gcloud sql instances create mcp-registry-db \
  --database-version=POSTGRES_15 \
  --tier=db-n1-standard-1 \
  --region=us-central1 \
  --root-password=YOUR_SECURE_PASSWORD

# Create database
gcloud sql databases create mcp_registry \
  --instance=mcp-registry-db

# Get connection name (needed later)
export DB_CONNECTION_NAME=$(gcloud sql instances describe mcp-registry-db \
  --format="value(connectionName)")
```

### Step 4: Store Secrets

```bash
# Store API keys securely
echo -n "your-gemini-key" | gcloud secrets create google-gemini-api-key --data-file=-
echo -n "your-vision-key" | gcloud secrets create google-vision-api-key --data-file=-
echo -n "your-openai-key" | gcloud secrets create openai-api-key --data-file=-
echo -n "your-encryption-secret" | gcloud secrets create encryption-secret --data-file=-
echo -n "your-encryption-salt" | gcloud secrets create encryption-salt --data-file=-
echo -n "YOUR_SECURE_PASSWORD" | gcloud secrets create db-password --data-file=-
```

### Step 5: Build and Deploy

```bash
export PROJECT_ID=$(gcloud config get-value project)
export FRONTEND_URL="https://your-app.vercel.app"

# Build container
gcloud builds submit --tag gcr.io/$PROJECT_ID/mcp-registry-backend ./backend

# Deploy to Cloud Run
gcloud run deploy mcp-registry-backend \
  --image gcr.io/$PROJECT_ID/mcp-registry-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances $DB_CONNECTION_NAME \
  --set-env-vars "NODE_ENV=production,PORT=3001,CORS_ORIGIN=$FRONTEND_URL" \
  --set-secrets "GOOGLE_GEMINI_API_KEY=google-gemini-api-key:latest,GOOGLE_VISION_API_KEY=google-vision-api-key:latest,OPENAI_API_KEY=openai-api-key:latest,ENCRYPTION_SECRET=encryption-secret:latest,ENCRYPTION_SALT=encryption-salt:latest" \
  --set-env-vars "DATABASE_URL=postgresql://postgres:$(gcloud secrets versions access latest --secret=db-password)@/$DB_CONNECTION_NAME/mcp_registry?host=/cloudsql/$DB_CONNECTION_NAME" \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 1

# Get service URL
export SERVICE_URL=$(gcloud run services describe mcp-registry-backend \
  --platform managed \
  --region us-central1 \
  --format="value(status.url)")
echo "✅ Backend deployed to: $SERVICE_URL"
```

### Step 6: Run Database Migrations

```bash
# Create migration job
gcloud run jobs create migrate-db \
  --image gcr.io/$PROJECT_ID/mcp-registry-backend \
  --region us-central1 \
  --add-cloudsql-instances $DB_CONNECTION_NAME \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "GOOGLE_GEMINI_API_KEY=google-gemini-api-key:latest" \
  --set-env-vars "DATABASE_URL=postgresql://postgres:$(gcloud secrets versions access latest --secret=db-password)@/$DB_CONNECTION_NAME/mcp_registry?host=/cloudsql/$DB_CONNECTION_NAME" \
  --command npm \
  --args "run,migrate:deploy"

# Execute migration
gcloud run jobs execute migrate-db --region us-central1
```

### Step 7: Update Frontend Environment

In Vercel dashboard, update:
```
NEXT_PUBLIC_API_URL=$SERVICE_URL
```

## Event Bus Setup (Kafka)

### Option A: Confluent Cloud (Recommended)

1. Sign up at [Confluent Cloud](https://www.confluent.io/confluent-cloud/)
2. Create cluster in same region (us-central1)
3. Get broker endpoints
4. Update Cloud Run:

```bash
gcloud run services update mcp-registry-backend \
  --region us-central1 \
  --update-env-vars "KAFKA_BROKERS=pkc-xxxxx.us-central1.gcp.confluent.cloud:9092"
```

### Option B: Cloud Pub/Sub

Cloud Pub/Sub can replace Kafka. Update event-bus service to use Pub/Sub client.

## CI/CD Setup

### Cloud Build Trigger

Create `.cloudbuild.yaml` in repository root:

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/mcp-registry-backend', './backend']
  
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/mcp-registry-backend']
  
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'mcp-registry-backend'
      - '--image'
      - 'gcr.io/$PROJECT_ID/mcp-registry-backend'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'

images:
  - 'gcr.io/$PROJECT_ID/mcp-registry-backend'
```

Create trigger:
```bash
gcloud builds triggers create github \
  --repo-name=mcp-registry \
  --repo-owner=YOUR_GITHUB_USERNAME \
  --branch-pattern="^main$" \
  --build-config=backend/cloudbuild.yaml
```

## Monitoring & Logging

### View Logs

```bash
# Stream logs
gcloud run services logs read mcp-registry-backend \
  --region us-central1 \
  --follow
```

### Set Up Alerts

In [Cloud Monitoring](https://console.cloud.google.com/monitoring):
- High error rate
- High latency
- Low availability
- Database connection errors

## Security Best Practices

1. ✅ Use Secret Manager for all API keys
2. ✅ Enable VPC Connector for private Cloud SQL access
3. ✅ Set up IAM with least privilege
4. ✅ Enable Cloud Armor for DDoS protection
5. ✅ Use Cloud SQL Private IP
6. ✅ Enable audit logs

## Cost Estimation

**Monthly estimates** (varies by usage):
- Cloud Run: ~$20-50 (2Gi memory, 2 CPU)
- Cloud SQL (db-n1-standard-1): ~$50
- Confluent Cloud: ~$20-100 (based on data volume)
- **Total: ~$90-200/month**

## Troubleshooting

### Database Connection Issues

```bash
# Check instance status
gcloud sql instances describe mcp-registry-db

# Verify Cloud SQL connection
gcloud run services update mcp-registry-backend \
  --region us-central1 \
  --add-cloudsql-instances $DB_CONNECTION_NAME
```

### Service Not Starting

```bash
# Check logs
gcloud run services logs read mcp-registry-backend \
  --region us-central1 \
  --limit 50
```

### Build Failures

```bash
# Test build locally
cd backend
docker build -t mcp-registry-backend .
docker run -p 3001:3001 mcp-registry-backend

# Check Cloud Build logs
gcloud builds list --limit=5
gcloud builds log BUILD_ID
```

## Testing Deployment

```bash
# Health check
curl $SERVICE_URL/health

# Test registry
curl $SERVICE_URL/v0.1/servers

# Test from frontend
# Navigate to your Vercel app and verify it can connect
```

## Next Steps

1. Set up custom domain (optional)
2. Enable Cloud CDN
3. Configure monitoring dashboards
4. Set up automated backups for Cloud SQL
5. Configure auto-scaling policies

## Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs/postgres)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Vercel Documentation](https://vercel.com/docs)





