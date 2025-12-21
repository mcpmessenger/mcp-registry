# GCP Deployment Guide

Complete guide for deploying the MCP Registry backend to Google Cloud Platform.

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│  Vercel (Frontend - Already Deployed) │
│  https://your-app.vercel.app           │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Cloud Run (Backend API)               │
│  https://mcp-registry-api.run.app      │
│  - Auto-scaling                        │
│  - Pay-per-use                         │
│  - HTTPS by default                    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Cloud SQL (PostgreSQL)                │
│  - Managed database                    │
│  - Automated backups                   │
│  - High availability                   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Cloud Pub/Sub (Event Bus)             │
│  OR Confluent Cloud (Kafka)            │
│  - Message queue for orchestration     │
└─────────────────────────────────────────┘
```

## 📋 Prerequisites

1. **GCP Account** with billing enabled
2. **gcloud CLI** installed and configured
3. **Docker** installed (for local testing)
4. **Git** repository access

## 🚀 Step-by-Step Deployment

### Step 1: Set Up GCP Project

```bash
# Login to GCP
gcloud auth login

# Set your project (create one if needed)
gcloud projects create mcp-registry-prod --name="MCP Registry Production"
gcloud config set project mcp-registry-prod

# Enable billing (required for Cloud Run and Cloud SQL)
# Do this in the GCP Console: https://console.cloud.google.com/billing
```

### Step 2: Enable Required APIs

```bash
# Enable Cloud Run API
gcloud services enable run.googleapis.com

# Enable Cloud SQL Admin API
gcloud services enable sqladmin.googleapis.com

# Enable Cloud Build API (for building containers)
gcloud services enable cloudbuild.googleapis.com

# Enable Secret Manager API (for storing API keys)
gcloud services enable secretmanager.googleapis.com

# Enable Pub/Sub API (if using Pub/Sub instead of Kafka)
gcloud services enable pubsub.googleapis.com

# Enable Container Registry API (for storing Docker images)
gcloud services enable containerregistry.googleapis.com
```

### Step 3: Create Cloud SQL PostgreSQL Instance

```bash
# Create PostgreSQL instance
gcloud sql instances create mcp-registry-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=YOUR_SECURE_PASSWORD

# Create database
gcloud sql databases create mcp_registry \
  --instance=mcp-registry-db

# Get connection name (you'll need this)
gcloud sql instances describe mcp-registry-db \
  --format="value(connectionName)"
# Output: PROJECT_ID:us-central1:mcp-registry-db
```

**Note**: For production, use a larger tier (e.g., `db-n1-standard-1`)

### Step 4: Store Secrets in Secret Manager

```bash
# Store API keys securely
echo -n "your-gemini-api-key" | gcloud secrets create google-gemini-api-key --data-file=-
echo -n "your-vision-api-key" | gcloud secrets create google-vision-api-key --data-file=-
echo -n "your-openai-api-key" | gcloud secrets create openai-api-key --data-file=-
echo -n "your-encryption-secret" | gcloud secrets create encryption-secret --data-file=-
echo -n "your-encryption-salt" | gcloud secrets create encryption-salt --data-file=-

# Store database password
echo -n "YOUR_SECURE_PASSWORD" | gcloud secrets create db-password --data-file=-
```

### Step 5: Build and Push Docker Image

```bash
# Set project ID
export PROJECT_ID=$(gcloud config get-value project)

# Build container image using Cloud Build
gcloud builds submit --tag gcr.io/$PROJECT_ID/mcp-registry-backend ./backend

# Verify image was created
gcloud container images list
```

### Step 6: Deploy to Cloud Run

```bash
# Get database connection name
export DB_CONNECTION_NAME=$(gcloud sql instances describe mcp-registry-db \
  --format="value(connectionName)")

# Get your Vercel frontend URL
export FRONTEND_URL="https://your-app.vercel.app"

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

# Get the service URL
gcloud run services describe mcp-registry-backend \
  --platform managed \
  --region us-central1 \
  --format="value(status.url)"
```

**Note**: The DATABASE_URL format for Cloud SQL uses Unix socket connection via `/cloudsql/`.

### Step 7: Run Database Migrations

```bash
# Get service URL
export SERVICE_URL=$(gcloud run services describe mcp-registry-backend \
  --platform managed \
  --region us-central1 \
  --format="value(status.url)")

# Option 1: Run migrations via Cloud Run job (recommended)
gcloud run jobs create migrate-db \
  --image gcr.io/$PROJECT_ID/mcp-registry-backend \
  --region us-central1 \
  --add-cloudsql-instances $DB_CONNECTION_NAME \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "GOOGLE_GEMINI_API_KEY=google-gemini-api-key:latest" \
  --set-env-vars "DATABASE_URL=postgresql://postgres:$(gcloud secrets versions access latest --secret=db-password)@/$DB_CONNECTION_NAME/mcp_registry?host=/cloudsql/$DB_CONNECTION_NAME" \
  --command npm \
  --args "run,migrate:deploy"

# Execute the migration job
gcloud run jobs execute migrate-db --region us-central1

# Option 2: Run migrations locally (if you have Cloud SQL Proxy)
# Download Cloud SQL Proxy: https://cloud.google.com/sql/docs/postgres/sql-proxy
# Then run: npm run migrate:deploy
```

### Step 8: Set Up Kafka (Optional - for Event-Driven Architecture)

You have two options:

#### Option A: Use Cloud Pub/Sub (GCP Native)

Cloud Pub/Sub can replace Kafka for most use cases. You'll need to update the event-bus service to use Pub/Sub instead of Kafka.

#### Option B: Use Confluent Cloud (Managed Kafka)

1. Sign up at [Confluent Cloud](https://www.confluent.io/confluent-cloud/)
2. Create a cluster in the same region (us-central1)
3. Get the broker endpoints
4. Update Cloud Run environment variables:

```bash
gcloud run services update mcp-registry-backend \
  --region us-central1 \
  --update-env-vars "KAFKA_BROKERS=pkc-xxxxx.us-central1.gcp.confluent.cloud:9092"
```

### Step 9: Update Frontend Environment Variables

In your Vercel dashboard:

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add/Update:
   ```
   NEXT_PUBLIC_API_URL=https://mcp-registry-backend-xxxxx.run.app
   ```

### Step 10: Test Deployment

```bash
# Get service URL
export SERVICE_URL=$(gcloud run services describe mcp-registry-backend \
  --platform managed \
  --region us-central1 \
  --format="value(status.url)")

# Test health endpoint
curl $SERVICE_URL/health

# Test registry endpoint
curl $SERVICE_URL/v0.1/servers
```

## 🔧 Configuration Details

### Environment Variables

Required environment variables for Cloud Run:

```bash
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://your-app.vercel.app
DATABASE_URL=postgresql://postgres:PASSWORD@/mcp_registry?host=/cloudsql/CONNECTION_NAME
KAFKA_BROKERS=your-kafka-brokers (if using Kafka)
```

### Secrets (via Secret Manager)

- `GOOGLE_GEMINI_API_KEY`
- `GOOGLE_VISION_API_KEY`
- `OPENAI_API_KEY`
- `ENCRYPTION_SECRET`
- `ENCRYPTION_SALT`
- `DB_PASSWORD` (for DATABASE_URL construction)

### Cloud Run Settings

- **Memory**: 2Gi (adjust based on usage)
- **CPU**: 2 vCPU
- **Timeout**: 300s (5 minutes) - for long-running tool invocations
- **Min Instances**: 1 (to avoid cold starts)
- **Max Instances**: 10 (adjust based on traffic)

## 🔄 CI/CD Setup (Optional)

### Using Cloud Build

Create `cloudbuild.yaml`:

```yaml
steps:
  # Build container
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/mcp-registry-backend', './backend']
  
  # Push to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/mcp-registry-backend']
  
  # Deploy to Cloud Run
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

Trigger on push:

```bash
gcloud builds triggers create github \
  --repo-name=mcp-registry \
  --repo-owner=YOUR_GITHUB_USERNAME \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

## 📊 Monitoring & Logging

### View Logs

```bash
# Stream logs
gcloud run services logs read mcp-registry-backend \
  --region us-central1 \
  --follow

# View in Console
# https://console.cloud.google.com/run/detail/us-central1/mcp-registry-backend/logs
```

### Set Up Alerts

1. Go to [Cloud Monitoring](https://console.cloud.google.com/monitoring)
2. Create alert policies for:
   - High error rate
   - High latency
   - Low availability
   - Database connection errors

## 🔐 Security Best Practices

1. **Use Secret Manager** for all API keys (already configured)
2. **Enable VPC Connector** if you need private Cloud SQL access
3. **Set up IAM** - limit who can deploy/update services
4. **Enable Cloud Armor** for DDoS protection
5. **Use Cloud SQL Private IP** for better security
6. **Enable audit logs** for compliance

## 💰 Cost Estimation

**Cloud Run** (pay-per-use):
- Free tier: 2 million requests/month
- After: ~$0.40 per million requests
- CPU/Memory: ~$0.00002400 per vCPU-second, ~$0.00000250 per GiB-second

**Cloud SQL** (db-f1-micro):
- ~$7.67/month (1 vCPU, 0.6GB RAM)
- For production, use db-n1-standard-1: ~$50/month

**Cloud Pub/Sub**:
- Free tier: 10GB/month
- After: $0.40 per million messages

**Estimated monthly cost**: ~$20-100 depending on usage

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check Cloud SQL instance status
gcloud sql instances describe mcp-registry-db

# Test connection from Cloud Run
gcloud run services update mcp-registry-backend \
  --region us-central1 \
  --add-cloudsql-instances $DB_CONNECTION_NAME
```

### Container Build Failures

```bash
# Build locally to test
cd backend
docker build -t mcp-registry-backend .
docker run -p 3001:3001 mcp-registry-backend

# Check Cloud Build logs
gcloud builds list --limit=5
gcloud builds log BUILD_ID
```

### Service Not Starting

```bash
# Check logs
gcloud run services logs read mcp-registry-backend \
  --region us-central1 \
  --limit 50

# Check service status
gcloud run services describe mcp-registry-backend \
  --region us-central1
```

## 📝 Quick Deploy Script

Save as `deploy-gcp.ps1`:

```powershell
# GCP Deployment Script
$PROJECT_ID = "mcp-registry-prod"
$REGION = "us-central1"
$SERVICE_NAME = "mcp-registry-backend"

# Set project
gcloud config set project $PROJECT_ID

# Build and push
Write-Host "Building container..." -ForegroundColor Yellow
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME ./backend

# Get database connection
$DB_CONNECTION = gcloud sql instances describe mcp-registry-db --format="value(connectionName)"

# Deploy
Write-Host "Deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $SERVICE_NAME `
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME `
  --platform managed `
  --region $REGION `
  --allow-unauthenticated `
  --add-cloudsql-instances $DB_CONNECTION `
  --set-env-vars "NODE_ENV=production,PORT=3001" `
  --set-secrets "GOOGLE_GEMINI_API_KEY=google-gemini-api-key:latest,GOOGLE_VISION_API_KEY=google-vision-api-key:latest,OPENAI_API_KEY=openai-api-key:latest" `
  --memory 2Gi `
  --cpu 2 `
  --timeout 300

# Get URL
$SERVICE_URL = gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format="value(status.url)"
Write-Host "✅ Deployed to: $SERVICE_URL" -ForegroundColor Green
```

## 🔗 Next Steps

1. **Set up custom domain** (optional):
   ```bash
   gcloud run domain-mappings create \
     --service mcp-registry-backend \
     --domain api.yourdomain.com \
     --region us-central1
   ```

2. **Enable Cloud CDN** for better performance

3. **Set up monitoring dashboards** in Cloud Monitoring

4. **Configure auto-scaling** based on metrics

5. **Set up backup strategy** for Cloud SQL

## 📚 Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs/postgres)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
