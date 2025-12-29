# Final Steps: Complete Database Setup

## ✅ Deployment Successful!

Your Cloud Run service has been deployed with Cloud SQL connection:
- Revision: `mcp-registry-backend-00137-4fj`
- Status: ✅ Deployed and running
- Traffic: 100%

## Step 1: Update backend/.env

Add the DATABASE_URL to your `backend/.env` file:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db"
```

**Replace `YOUR_PASSWORD`** with your Cloud SQL root password.

## Step 2: Generate Prisma Client and Run Migrations

Open PowerShell and run:

```powershell
cd backend

# Generate Prisma client for PostgreSQL
npx prisma generate

# Run migrations (creates tables in your database)
npx prisma migrate deploy
```

This will create all the database tables needed for your application.

## Step 3: Set DATABASE_URL in Cloud Run

After migrations complete, set the environment variable in Cloud Run:

1. **Go to Cloud Run Console**: 
   https://console.cloud.google.com/run/detail/us-central1/mcp-registry-backend?project=554655392699

2. Click **"Edit & Deploy New Revision"**

3. Go to **"Variables & Secrets"** tab

4. Under **"Environment variables"**, click **"Add Variable"**

5. Add:
   - **Name**: `DATABASE_URL`
   - **Value**: `postgresql://postgres:YOUR_PASSWORD@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db`
   - Replace `YOUR_PASSWORD` with your actual password

6. Click **"Deploy"**

## Step 4: Test It!

After setting the environment variable:

```powershell
# Test health endpoint
Invoke-WebRequest -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/health"

# Test servers endpoint (should work now without database error!)
Invoke-WebRequest -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers"
```

The servers endpoint should return data (or empty array) instead of a 500 error!

## Summary

✅ Cloud Run deployed with Cloud SQL connection  
⏭️ Next: Update .env → Run migrations → Set env var in Cloud Run → Test

