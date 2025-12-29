# Debug Permission Issues

## Check Build Logs

Get detailed build logs:
```bash
# Use the build ID from the error message
gcloud builds log d144e030-1d6d-465f-80a0-f35332a88634

# Or list recent builds
gcloud builds list --limit=5
```

## Verify Code is Updated

```bash
cd ~/mcp-registry
git log --oneline -1
# Should show: 63350ac Hardcode project name 'slashmcp'...

# If not, pull:
git pull
cd backend
```

## Check Image Path

The script should now use:
- `us-central1-docker.pkg.dev/slashmcp/mcp-registry/mcp-registry-backend`

Not:
- `us-central1-docker.pkg.dev/554655392699/mcp-registry/mcp-registry-backend`

## Verify Permissions

```bash
PROJECT_ID="554655392699"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Check current permissions
gcloud projects get-iam-policy $PROJECT_ID \
    --flatten="bindings[].members" \
    --filter="bindings.members:serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --format="table(bindings.role)"
```

Should show `roles/artifactregistry.writer`.

## Alternative: Use Project ID Consistently

If the repository was actually created with project ID, we might need to recreate it or use project ID everywhere. Check:

```bash
gcloud artifacts repositories describe mcp-registry --location=us-central1 --format="value(name)"
```

This will show the full resource path.


