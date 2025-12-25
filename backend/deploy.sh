#!/bin/bash
# Deployment script for SlashMCP.com Backend
# Run this script from the backend directory in Google Cloud Shell

PROJECT_ID="554655392699"
SERVICE_NAME="mcp-registry-backend"
REGION="us-central1"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Deploying SlashMCP.com Backend to Cloud Run"
echo "Project ID: ${PROJECT_ID}"
echo "Service: ${SERVICE_NAME}"
echo "Region: ${REGION}"
echo ""

# Step 1: Build and push container image
echo "📦 Building and pushing container image..."
gcloud builds submit --tag ${IMAGE_NAME} --region ${REGION} .

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Image built and pushed successfully"
echo ""

# Step 2: Deploy to Cloud Run
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

