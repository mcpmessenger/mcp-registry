# Remove Filesystem Server from Production Database

## Quick Method: Using Cloud SQL Proxy (Recommended)

### Step 1: Start Cloud SQL Proxy

In a separate terminal, start the proxy:

```powershell
cd C:\Users\senti\OneDrive\Desktop\mcp-registry
.\cloud-sql-proxy.exe --instances=slashmcp:us-central1:mcp-registry-db=tcp:5432
```

Keep this running in the background.

### Step 2: Set Production Database URL

In your main terminal, set the DATABASE_URL environment variable to point to production:

```powershell
cd backend
$env:DATABASE_URL = "postgresql://postgres:Aardvark41%2B@localhost:5432/mcp_registry"
```

**Note:** Replace `Aardvark41%2B` with your actual database password if different.

### Step 3: Run the Removal Script

```powershell
npm run remove-filesystem
```

This will:
- Connect to the production database via the proxy
- Find and remove the Filesystem server
- Confirm the deletion

### Step 4: Verify

Check the registry UI - Filesystem should be gone and the count should decrease by 1.

---

## Alternative: Using Cloud Run Job

If you prefer to run it as a Cloud Run job:

```powershell
# Set variables
$PROJECT_ID = "slashmcp"
$CONNECTION_NAME = "slashmcp:us-central1:mcp-registry-db"
$IMAGE = "gcr.io/$PROJECT_ID/mcp-registry-backend:latest"

# Get password from secret
$DB_PASSWORD = gcloud secrets versions access latest --secret=db-password

# Create job (one-time)
gcloud run jobs create remove-filesystem `
  --image $IMAGE `
  --region us-central1 `
  --add-cloudsql-instances $CONNECTION_NAME `
  --set-env-vars "DATABASE_URL=postgresql://postgres:$DB_PASSWORD@/$CONNECTION_NAME/mcp_registry?host=/cloudsql/$CONNECTION_NAME,NODE_ENV=production" `
  --command npm `
  --args "run,remove-filesystem"

# Execute the job
gcloud run jobs execute remove-filesystem --region us-central1
```

---

## Check Active Count Issue

After removing Filesystem, if the active count is still wrong, we may need to investigate which servers are incorrectly marked as active. The status is determined by:

1. Explicit `metadata.integrationStatus` (highest priority)
2. Whether the server has tools (if no explicit status)
3. Defaults to `pre-integration`

To check which servers are marked as active, you can query the database or check the API response.
