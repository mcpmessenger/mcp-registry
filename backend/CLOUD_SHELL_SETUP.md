# Cloud Shell Setup - Missing deploy.sh

If `deploy.sh` is missing, check:

## 1. Check current directory and files:

```bash
pwd
ls -la
```

Make sure you're in `~/mcp-registry/backend`

## 2. Pull latest code from git:

```bash
cd ~/mcp-registry
git pull
cd backend
ls -la deploy.sh
```

## 3. If deploy.sh still doesn't exist, create it:

The file should exist in your repository. If it's missing, you can create it from the repository files or pull the latest changes.

## 4. Alternative: Use gcloud commands directly

If deploy.sh is truly missing, you can deploy manually:

```bash
PROJECT_ID="554655392699"
SERVICE_NAME="mcp-registry-backend"
REGION="us-central1"
REPOSITORY="mcp-registry"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}"

# Build and push
gcloud builds submit --tag $IMAGE_NAME --region $REGION .

# Deploy
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --timeout 300 \
    --set-env-vars "$(cat .env | grep -v '^#' | grep '=' | tr '\n' ',' | sed 's/,$//')"
```

But first, try `git pull` to get the latest code including deploy.sh.

