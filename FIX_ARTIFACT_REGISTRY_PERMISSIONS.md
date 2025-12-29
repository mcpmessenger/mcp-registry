# Fix Artifact Registry Permissions

## Problem
Cloud Build service account doesn't have permission to push to Artifact Registry.

## Solution
Grant the Cloud Build service account the `Artifact Registry Writer` role.

## Steps to Fix

### Option 1: Using gcloud (Admin Terminal)

Run these commands in an **admin PowerShell terminal**:

```powershell
# Get your project number
$PROJECT_ID = "554655392699"
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"

# Grant Cloud Build service account permission to push to Artifact Registry
gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" `
    --role="roles/artifactregistry.writer"

# Also ensure the repository exists
gcloud artifacts repositories create mcp-registry `
    --repository-format=docker `
    --location=us-central1 `
    --description="Docker repository for MCP Registry Backend" `
    --project=$PROJECT_ID
```

### Option 2: Using Cloud Console (Easier)

1. **Enable Artifact Registry API** (if not already enabled):
   - Go to: https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com?project=554655392699
   - Click "Enable"

2. **Grant Cloud Build permissions**:
   - Go to: https://console.cloud.google.com/cloud-build/settings/service-account?project=554655392699
   - Ensure "Cloud Build Service Account" has "Artifact Registry Writer" role
   - If not, click "Edit Permissions" and add the role

3. **Create Repository** (if not exists):
   - Go to: https://console.cloud.google.com/artifacts?project=554655392699
   - Click "Create Repository"
   - Name: `mcp-registry`
   - Format: Docker
   - Location: `us-central1`
   - Click "Create"

## Then Deploy Again

After granting permissions, deploy again:

```powershell
cd backend
.\deploy.ps1
```

