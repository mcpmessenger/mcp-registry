#!/bin/bash
# Deployment script using Artifact Registry (GCR is deprecated)

PROJECT_ID="slashmcp"  # Your actual project ID
REGION="us-central1"
SERVICE_NAME="mcp-registry-backend"
REPOSITORY_NAME="mcp-registry"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY_NAME}/${SERVICE_NAME}"

echo "🚀 Deploying MCP Registry Backend to Cloud Run"
echo "Project ID: ${PROJECT_ID}"
echo "Service: ${SERVICE_NAME}"
echo "Region: ${REGION}"
echo ""

# Step 1: Set the project
gcloud config set project ${PROJECT_ID}

# Step 2: Create Artifact Registry repository if it doesn't exist
echo "📦 Checking/creating Artifact Registry repository..."
gcloud artifacts repositories create ${REPOSITORY_NAME} \
  --repository-format=docker \
  --location=${REGION} \
  --description="MCP Registry Backend Docker images" \
  2>/dev/null || echo "Repository already exists, continuing..."

# Step 3: Build and push to Artifact Registry
echo "🔨 Building and pushing container image..."
echo "This may take 5-10 minutes..."

# Copy Dockerfile.debian to Dockerfile for gcloud builds submit
cp Dockerfile.debian Dockerfile

# Build and push
gcloud builds submit --tag ${IMAGE_NAME} --region ${REGION} .

# Clean up temporary Dockerfile (optional - can keep it)
rm -f Dockerfile

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Image built and pushed successfully"
echo ""

# Step 4: Deploy to Cloud Run
echo "☁️  Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --platform managed \
    --region ${REGION} \
    --allow-unauthenticated

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed!"
    exit 1
fi

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')

echo ""
echo "✅ Deployment successful!"
echo "📍 Service URL: ${SERVICE_URL}"
echo "🏥 Health check: ${SERVICE_URL}/health"

