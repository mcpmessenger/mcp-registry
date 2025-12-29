# Setup Docker Authentication for Artifact Registry

## Quick Fix

Run this command to authenticate Docker with Artifact Registry:

```powershell
gcloud auth configure-docker us-central1-docker.pkg.dev
```

This will configure Docker to use your gcloud credentials when pushing to Artifact Registry.

## Then Deploy Again

After authentication, run the local Docker deploy script:

```powershell
.\deploy-local-docker.ps1
```

## Alternative: Manual Authentication

If the above doesn't work:

1. **Make sure you're logged in to gcloud**:
   ```powershell
   gcloud auth login
   ```

2. **Configure Docker**:
   ```powershell
   gcloud auth configure-docker us-central1-docker.pkg.dev
   ```

3. **Or use application default credentials**:
   ```powershell
   gcloud auth application-default login
   ```

4. **Then deploy**:
   ```powershell
   .\deploy-local-docker.ps1
   ```

