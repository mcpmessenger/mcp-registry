# Quick Deploy Fix - Summary

## The Problem
Multiple permission issues preventing deployment to Artifact Registry.

## Recommended Solution: Use Cloud Build with Proper Permissions

### Step 1: Grant Permissions in Cloud Console

1. **Grant your user account permission**:
   - Go to: https://console.cloud.google.com/iam-admin/iam?project=554655392699
   - Find: `williamtflynn@gmail.com`
   - Click edit (pencil icon)
   - Add role: **Artifact Registry Writer**
   - Save

2. **Grant Cloud Build service account permission**:
   - In the same IAM page, find or add: `[PROJECT_NUMBER]@cloudbuild.gserviceaccount.com`
   - To find project number: Look at your existing service accounts or go to Project Settings
   - Add role: **Artifact Registry Writer**
   - Save

### Step 2: Create Repository (if needed)

1. Go to: https://console.cloud.google.com/artifacts?project=554655392699
2. Create repository: `mcp-registry`
   - Format: Docker
   - Location: `us-central1`

### Step 3: Deploy Using Cloud Build

Once permissions are set, use the regular deploy script:

```powershell
cd C:\Users\senti\OneDrive\Desktop\mcp-registry\backend
.\deploy.ps1
```

This uses `gcloud builds submit` which runs in Cloud Build (no local Docker needed).

## Alternative: Fix Docker Auth (If you prefer local builds)

If you want to use local Docker builds, you need to run gcloud commands in an admin terminal or use Command Prompt instead of PowerShell.

The Cloud Build approach (Step 3 above) is usually easier since it doesn't require local Docker authentication.

