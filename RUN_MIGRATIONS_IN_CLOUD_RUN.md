# Run Migrations in Cloud Run (Recommended)

## Problem
The Unix socket format (`?host=/cloudsql/...`) only works inside Cloud Run, not from your local machine. That's why local migrations are failing.

## Solution: Run Migrations in Cloud Run

Since your Cloud Run service already has the DATABASE_URL set, you can run migrations there.

### Option 1: Create a Migration Job (Recommended)

1. **Go to Cloud Run Jobs**: https://console.cloud.google.com/run/jobs?project=554655392699

2. **Create a new job**:
   - Name: `mcp-registry-migrate`
   - Use the same image: `gcr.io/554655392699/mcp-registry-backend`
   - Set environment variable: `DATABASE_URL` (same as your service)
   - Command: `npx prisma migrate deploy`

3. **Run the job** to execute migrations

### Option 2: Test Backend First

Since Cloud Run has DATABASE_URL set, test if the backend works:

```powershell
# Test health
Invoke-WebRequest -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/health"

# Test servers endpoint
Invoke-WebRequest -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers"
```

If the servers endpoint works, migrations might have already run, or the backend might create tables automatically.

### Option 3: Enable Public IP for Local Migrations

1. Go to Cloud SQL Console
2. Enable Public IP
3. Update local `.env` to use TCP:
   ```
   DATABASE_URL="postgresql://postgres:gLTiCaO4qxQIHchmk7Dt@PUBLIC_IP:5432/mcp_registry"
   ```
4. Run migrations locally

## Current Status

✅ Cloud Run has DATABASE_URL set  
✅ Backend deployed  
⏭️ Next: Test backend → Run migrations if needed

