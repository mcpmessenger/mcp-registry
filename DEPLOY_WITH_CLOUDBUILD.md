# Alternative: Deploy Using cloudbuild.yaml

If the Cloud Console source deploy has issues with the Dockerfile path, use this method instead.

## Step 1: Create cloudbuild.yaml in Repository Root

Create a file `c:\Users\senti\OneDrive\Desktop\mcp-registry\cloudbuild.yaml`:

```yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'us-central1-docker.pkg.dev/slashmcp/mcp-registry/mcp-registry-backend:$COMMIT_SHA'
      - '-t'
      - 'us-central1-docker.pkg.dev/slashmcp/mcp-registry/mcp-registry-backend:latest'
      - '-f'
      - 'backend/Dockerfile'
      - 'backend/'
    timeout: 1200s

  # Push the container image to Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'us-central1-docker.pkg.dev/slashmcp/mcp-registry/mcp-registry-backend:latest'

  # Deploy container image to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'mcp-registry-backend'
      - '--image'
      - 'us-central1-docker.pkg.dev/slashmcp/mcp-registry/mcp-registry-backend:latest'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--memory'
      - '2Gi'
      - '--cpu'
      - '2'
      - '--timeout'
      - '300'
      - '--max-instances'
      - '10'
      - '--min-instances'
      - '0'

images:
  - 'us-central1-docker.pkg.dev/slashmcp/mcp-registry/mcp-registry-backend:latest'

timeout: 2400s

options:
  machineType: 'E2_HIGHCPU_8'
  logging: CLOUD_LOGGING_ONLY
```

## Step 2: Commit and Push

```bash
cd c:\Users\senti\OneDrive\Desktop\mcp-registry
git add cloudbuild.yaml
git commit -m "Add Cloud Build configuration"
git push origin main
```

## Step 3: Set Up Cloud Build Trigger

1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers?project=554655392699)
2. Click **CREATE TRIGGER**
3. Configure:
   - **Name**: `deploy-backend`
   - **Event**: Push to a branch
   - **Repository**: `mcpmessenger/mcp-registry`
   - **Branch**: `^main$`
   - **Configuration**: Cloud Build configuration file (yaml or json)
   - **Location**: `cloudbuild.yaml`
4. Click **CREATE**

## Step 4: Trigger Build Manually (First Time)

1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers?project=554655392699)
2. Find your `deploy-backend` trigger
3. Click **RUN** → **RUN TRIGGER**
4. Watch the build in the [Cloud Build History](https://console.cloud.google.com/cloud-build/builds?project=554655392699)

## Step 5: Set Environment Variables

After deployment completes, set environment variables:

1. Go to [Cloud Run Services](https://console.cloud.google.com/run?project=554655392699)
2. Click `mcp-registry-backend`
3. Click **EDIT & DEPLOY NEW REVISION**
4. Go to **Variables & Secrets** tab
5. Add all environment variables (DATABASE_URL, API keys, etc.)
6. Click **DEPLOY**

---

## Why This Method?

✅ More reliable (explicit paths)
✅ Faster builds (Cloud Build is optimized)
✅ Auto-deploy on push to main (after setup)
✅ Better error messages
✅ Version control of build config

---

## Quick Fix for Current Issue

**If you want to retry the current deployment**, make sure you set:
- **Dockerfile**: `/backend/Dockerfile` (not just `backend/Dockerfile`)
- **Build context**: `backend/` (or leave as `/` and adjust Dockerfile COPY paths)

The issue is that Cloud Build needs the exact path from the repository root.
