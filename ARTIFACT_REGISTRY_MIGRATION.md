# Artifact Registry Migration

## Problem
Google Container Registry (GCR) is deprecated and shutting down. The deploy script was using `gcr.io` which no longer works.

## Solution
Updated deploy scripts to use Artifact Registry instead of GCR.

## Changes Made

### Image Name Format
- **Old**: `gcr.io/PROJECT_ID/SERVICE_NAME`
- **New**: `REGION-docker.pkg.dev/PROJECT_ID/REPOSITORY/SERVICE_NAME`

### Repository
- **Repository Name**: `mcp-registry`
- **Location**: `us-central1`
- **Format**: Docker

### Updated Files
- ✅ `backend/deploy.ps1` - Updated to use Artifact Registry
- ✅ `backend/deploy.sh` - Updated to use Artifact Registry

### Auto-Creation
The deploy script now automatically:
1. Checks if the Artifact Registry repository exists
2. Creates it if it doesn't exist
3. Then builds and pushes the image

## Next Step

Deploy again - the script will automatically create the repository if needed:

```powershell
cd backend
.\deploy.ps1
```

The first run will:
1. Create the Artifact Registry repository
2. Build and push the Docker image
3. Deploy to Cloud Run

Subsequent runs will skip repository creation since it already exists.

