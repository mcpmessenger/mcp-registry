# Fix Permissions Using Cloud Console (Easiest Method)

If the CLI method isn't working, use the Cloud Console to fix permissions:

## Step 1: Create Repository (if it doesn't exist)

1. Go to Artifact Registry: https://console.cloud.google.com/artifacts?project=554655392699
2. Click **"Create Repository"**
3. Fill in:
   - **Name**: `mcp-registry`
   - **Format**: Docker
   - **Location**: `us-central1`
   - **Description**: Docker repository for MCP Registry Backend
4. Click **"Create"**

## Step 2: Grant Cloud Build Permissions

1. Go to IAM & Admin: https://console.cloud.google.com/iam-admin/iam?project=554655392699
2. Find the Cloud Build service account:
   - Look for: `[PROJECT_NUMBER]@cloudbuild.gserviceaccount.com`
   - If you can't find it, check Cloud Build settings: https://console.cloud.google.com/cloud-build/settings?project=554655392699
3. Click the **edit icon (pencil)** next to the service account
4. Click **"Add Another Role"**
5. Select: **Artifact Registry Writer**
6. Click **"Save"**

## Step 3: Alternative - Grant to Your User Account

If Cloud Build service account permissions don't work, grant permissions to your user:

1. Go to IAM & Admin: https://console.cloud.google.com/iam-admin/iam?project=554655392699
2. Click **"Grant Access"** (or find your user email)
3. Add role: **Artifact Registry Writer**
4. Click **"Save"**

Then use the local Docker build method instead of `gcloud builds submit`.

## After Fixing Permissions

Deploy again:
```powershell
.\deploy.ps1
```

Or use local Docker build (bypasses Cloud Build):
```powershell
.\deploy-local-docker.ps1
```

