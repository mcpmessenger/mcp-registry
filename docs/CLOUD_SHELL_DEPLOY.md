# Deploy from Google Cloud Shell

Since you have Google Cloud Shell open, use these commands:

## Quick Deploy Steps

1. **Upload or clone the repository in Cloud Shell:**
   ```bash
   # If you need to clone:
   git clone https://github.com/mcpmessenger/mcp-registry.git
   cd mcp-registry/backend
   
   # Or if you already have it, just navigate:
   cd mcp-registry/backend
   ```

2. **Set your project:**
   ```bash
   gcloud config set project 554655392699
   ```

3. **Deploy using the script:**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

   **OR manually:**
   ```bash
   PROJECT_ID="554655392699"
   
   # Build and push
   gcloud builds submit --tag gcr.io/${PROJECT_ID}/mcp-registry-backend --region us-central1 .
   
   # Deploy
   gcloud run deploy mcp-registry-backend \
     --image gcr.io/${PROJECT_ID}/mcp-registry-backend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

## What This Will Do

1. ✅ Build the backend container with all the fixes
2. ✅ Push it to Google Container Registry
3. ✅ Deploy to Cloud Run
4. ✅ Update the service with the new code

## After Deployment

Test your design request again - it should now return a proper response instead of "Internal server error"!

