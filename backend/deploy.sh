#!/bin/bash
# Deployment script for MCP Registry Backend
# Run this script from the backend directory
#
# Usage:
#   ./deploy.sh
#   ./deploy.sh --set-env-vars  # Update environment variables only
#   ./deploy.sh --skip-build    # Deploy existing image only

set -e

PROJECT_ID="554655392699"
# Use project name "slashmcp" for Artifact Registry (repository was created with this name)
PROJECT_NAME="slashmcp"
SERVICE_NAME="mcp-registry-backend"
REGION="us-central1"
REPOSITORY="mcp-registry"
# Use project name in image path (matches how repository was created: us-central1-docker.pkg.dev/slashmcp/mcp-registry)
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_NAME}/${REPOSITORY}/${SERVICE_NAME}"

SET_ENV_VARS=false
SKIP_BUILD=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --set-env-vars)
            SET_ENV_VARS=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--set-env-vars] [--skip-build]"
            exit 1
            ;;
    esac
done

echo "🚀 Deploying MCP Registry Backend to Cloud Run"
echo "Project ID: ${PROJECT_ID}"
echo "Service: ${SERVICE_NAME}"
echo "Region: ${REGION}"
echo ""

# Check if .env file exists
ENV_FILE=".env"
HAS_ENV_FILE=false
if [ -f "$ENV_FILE" ]; then
    HAS_ENV_FILE=true
fi

if [ "$SET_ENV_VARS" = true ] && [ "$HAS_ENV_FILE" = false ]; then
    echo "⚠️  Warning: .env file not found. Environment variables will not be updated."
    echo "   Create a .env file or use Secret Manager for sensitive values."
    echo ""
fi

# Step 1: Grant Cloud Build permissions (if needed)
if [ "$SKIP_BUILD" = false ] && [ "$SET_ENV_VARS" = false ]; then
    echo "🔐 Checking Cloud Build permissions..."
    PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)" 2>/dev/null)
    if [ -n "$PROJECT_NUMBER" ]; then
        SERVICE_ACCOUNT="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
        echo "   Service Account: ${SERVICE_ACCOUNT}"
        
        # Grant Artifact Registry Writer role (idempotent - safe to run multiple times)
        gcloud projects add-iam-policy-binding ${PROJECT_ID} \
            --member="serviceAccount:${SERVICE_ACCOUNT}" \
            --role="roles/artifactregistry.writer" \
            --condition=None 2>/dev/null || echo "   (Permissions may already be set)"
    fi
    echo ""
fi

# Step 2: Ensure Artifact Registry repository exists
if [ "$SKIP_BUILD" = false ] && [ "$SET_ENV_VARS" = false ]; then
    echo "🔍 Checking Artifact Registry repository..."
    if ! gcloud artifacts repositories describe ${REPOSITORY} --location=${REGION} &>/dev/null; then
        echo "📦 Creating Artifact Registry repository..."
        gcloud artifacts repositories create ${REPOSITORY} \
            --repository-format=docker \
            --location=${REGION} \
            --description="Docker repository for MCP Registry Backend"
        
        if [ $? -ne 0 ]; then
            echo "❌ Failed to create repository!"
            exit 1
        fi
        echo "✅ Repository created successfully"
    else
        echo "✅ Repository already exists"
    fi
    echo ""
fi

# Step 3: Build and push container image (skip if flag is set)
if [ "$SKIP_BUILD" = false ] && [ "$SET_ENV_VARS" = false ]; then
    echo "📦 Building and pushing container image..."
    gcloud builds submit --tag ${IMAGE_NAME} --region ${REGION} .
    
    if [ $? -ne 0 ]; then
        echo "❌ Build failed!"
        exit 1
    fi
    
    echo "✅ Image built and pushed successfully"
    echo ""
fi

# Step 4: Prepare environment variables
ENV_VARS=()
SECRETS=()

if [ "$HAS_ENV_FILE" = true ] && [ "$SKIP_BUILD" = false ]; then
    echo "📝 Reading environment variables from .env..."
    
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip empty lines and comments
        if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
            continue
        fi
        
        # Parse KEY=VALUE
        if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
            KEY="${BASH_REMATCH[1]// /}"
            VALUE="${BASH_REMATCH[2]// /}"
            VALUE="${VALUE#\"}"  # Remove leading quote
            VALUE="${VALUE%\"}"  # Remove trailing quote
            VALUE="${VALUE#\'}"  # Remove leading single quote
            VALUE="${VALUE%\'}"  # Remove trailing single quote
            
            # Skip DATABASE_URL if it's a file path (use Cloud SQL instead)
            if [ "$KEY" = "DATABASE_URL" ] && [[ "$VALUE" == file:* ]]; then
                echo "   ⚠️  Skipping local DATABASE_URL (file:). Use Cloud SQL connection string."
                continue
            fi
            
            # Check if it's a secret reference (format: secret-name:latest)
            if [[ "$VALUE" =~ ^[a-zA-Z0-9_-]+:latest$ ]]; then
                SECRETS+=("${KEY}=${VALUE}")
                echo "   ✓ Added secret: ${KEY}=${VALUE}"
            elif [ "$KEY" = "CORS_ORIGIN" ] && [ -z "$VALUE" ]; then
                # Skip empty CORS_ORIGIN (will be set to allow all)
                :
            else
                ENV_VARS+=("${KEY}=${VALUE}")
                echo "   ✓ Added env var: ${KEY}"
            fi
        fi
    done < "$ENV_FILE"
    
    echo ""
fi

# Step 5: Build deployment command
DEPLOY_CMD="gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --platform managed \
    --region ${REGION} \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0"

# Add environment variables if any
# Properly handle values with commas by using --update-env-vars with individual key=value pairs
if [ ${#ENV_VARS[@]} -gt 0 ]; then
    # For values with commas, we need to pass them separately or use env-vars-file
    # Use --update-env-vars which can handle quoted values better
    for env_var in "${ENV_VARS[@]}"; do
        DEPLOY_CMD="${DEPLOY_CMD} --update-env-vars ${env_var}"
    done
fi

# Add secrets if any
if [ ${#SECRETS[@]} -gt 0 ]; then
    SECRET_STRING=$(IFS=,; echo "${SECRETS[*]}")
    DEPLOY_CMD="${DEPLOY_CMD} --set-secrets \"${SECRET_STRING}\""
fi

# If only setting env vars, update them separately
if [ "$SET_ENV_VARS" = true ]; then
    echo "🔧 Updating environment variables only..."
    
    if [ ${#ENV_VARS[@]} -gt 0 ]; then
        ENV_VAR_STRING=$(IFS=,; echo "${ENV_VARS[*]}")
        gcloud run services update ${SERVICE_NAME} \
            --region ${REGION} \
            --update-env-vars "${ENV_VAR_STRING}"
    fi
    
    if [ ${#SECRETS[@]} -gt 0 ]; then
        SECRET_STRING=$(IFS=,; echo "${SECRETS[*]}")
        gcloud run services update ${SERVICE_NAME} \
            --region ${REGION} \
            --update-secrets "${SECRET_STRING}"
    fi
    
    echo "✅ Environment variables updated!"
    echo ""
else
    # Step 6: Deploy to Cloud Run
    echo "☁️  Deploying to Cloud Run..."
    eval $DEPLOY_CMD
    
    if [ $? -ne 0 ]; then
        echo "❌ Deployment failed!"
        exit 1
    fi
fi

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')

echo ""
echo "✅ Deployment successful!"
echo "📍 Service URL: ${SERVICE_URL}"
echo "🏥 Health check: ${SERVICE_URL}/health"
echo ""
echo "📝 Next steps:"
echo "   1. Update Vercel environment variable: NEXT_PUBLIC_API_URL=${SERVICE_URL}"
echo "   2. Update backend CORS_ORIGIN to allow your Vercel domain"
echo ""

