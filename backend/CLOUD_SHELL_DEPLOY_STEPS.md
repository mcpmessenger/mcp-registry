# Cloud Shell Deployment Steps

Since you're already in `~/mcp-registry/backend`, follow these steps:

## 1. Check/Update .env file

```bash
# Check if .env exists
ls -la .env

# If you need to create/update it
nano .env
```

Make sure it has:
- `DATABASE_URL` (with Cloud SQL connection)
- `CORS_ORIGIN` (with your domains)
- `PORT=8080`
- `NODE_ENV=production`
- Other required env vars

## 2. Grant Permissions (if not already done)

```bash
PROJECT_ID="554655392699"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant Cloud Build permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/artifactregistry.writer"

# Create repository if needed
gcloud artifacts repositories create mcp-registry \
    --repository-format=docker \
    --location=us-central1 \
    --description="Docker repository" 2>/dev/null || echo "Repository exists"
```

## 3. Deploy

```bash
chmod +x deploy.sh
./deploy.sh
```

This will build and deploy everything!

