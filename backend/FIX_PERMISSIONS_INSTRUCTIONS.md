# Fix IAM Permissions for Artifact Registry

## The Problem
Cloud Build service account needs permission to push images to Artifact Registry.

## Quick Fix (Run in Admin Terminal)

### Option 1: Use the Helper Script

1. **Open PowerShell as Administrator**
   - Right-click PowerShell → "Run as Administrator"

2. **Navigate to backend directory**:
   ```powershell
   cd C:\Users\senti\OneDrive\Desktop\mcp-registry\backend
   ```

3. **Run the fix script**:
   ```powershell
   .\fix-permissions.ps1
   ```

### Option 2: Run Commands Manually

In an **admin PowerShell terminal**:

```powershell
$PROJECT_ID = "554655392699"
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" --role="roles/artifactregistry.writer"
```

### Option 3: Using Cloud Console (No Admin Needed)

1. Go to: https://console.cloud.google.com/iam-admin/iam?project=554655392699
2. Find service account: `[PROJECT_NUMBER]@cloudbuild.gserviceaccount.com`
   - If you don't see it, go to: https://console.cloud.google.com/cloud-build/settings?project=554655392699
3. Click the edit icon (pencil) next to the service account
4. Click "Add Another Role"
5. Select: **Artifact Registry Writer**
6. Click "Save"

## After Fixing Permissions

Deploy again:
```powershell
cd backend
.\deploy.ps1
```

## Verify Permissions

Check if permissions were granted:
```powershell
$PROJECT_ID = "554655392699"
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
gcloud projects get-iam-policy $PROJECT_ID --flatten="bindings[].members" --filter="bindings.members:serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" --format="table(bindings.role)"
```

You should see `roles/artifactregistry.writer` in the list.

