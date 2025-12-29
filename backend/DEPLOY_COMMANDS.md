# Deploy Commands for Cloud Shell

After you've updated your `.env` file, run these commands:

```bash
# Make the deploy script executable (first time only)
chmod +x deploy.sh

# Deploy to Cloud Run
./deploy.sh
```

That's it! The script will:
1. ✅ Check/create Artifact Registry repository
2. ✅ Build Docker image using Cloud Build
3. ✅ Push image to Artifact Registry
4. ✅ Read environment variables from .env
5. ✅ Deploy to Cloud Run with all env vars configured

## Expected Output

You should see:
- Building and pushing container image...
- Reading environment variables from .env...
- Deploying to Cloud Run...
- Deployment successful!
- Service URL: https://mcp-registry-backend-554655392699.us-central1.run.app

## If You Get Permission Errors

If you see permission errors, run these first:

```bash
PROJECT_ID="554655392699"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/artifactregistry.writer"
```

