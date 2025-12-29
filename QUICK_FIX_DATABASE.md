# Quick Fix: Backend Database Error

## Problem
Backend deployed to Cloud Run but has no database configured, causing `PrismaClientInitializationError`.

## Root Cause
The deploy script skipped `DATABASE_URL="file:./dev.db"` (SQLite files don't work on Cloud Run).

## Quick Fix Options

### Option 1: Set Up Cloud SQL (Recommended - 10 minutes)

#### Step 1: Create Cloud SQL Instance

```powershell
# Run in PowerShell (admin terminal)
gcloud sql instances create mcp-registry-db `
    --database-version=POSTGRES_15 `
    --tier=db-f1-micro `
    --region=us-central1 `
    --root-password=CHANGE_THIS_PASSWORD

# Create database
gcloud sql databases create mcp_registry --instance=mcp-registry-db

# Get connection name
gcloud sql instances describe mcp-registry-db --format="value(connectionName)"
# Example output: 554655392699:us-central1:mcp-registry-db
```

#### Step 2: Update Backend .env

Edit `backend/.env`:

```env
DATABASE_URL="postgresql://postgres:CHANGE_THIS_PASSWORD@/mcp_registry?host=/cloudsql/554655392699:us-central1:mcp-registry-db"
```

Replace:
- `CHANGE_THIS_PASSWORD` with the password you set in step 1
- `554655392699:us-central1:mcp-registry-db` with your actual connection name

#### Step 3: Update Prisma Schema

Edit `backend/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"  // Change from "sqlite"
  url      = env("DATABASE_URL")
}
```

#### Step 4: Generate Prisma Client and Run Migrations

```powershell
cd backend

# Generate Prisma client for PostgreSQL
npx prisma generate

# Create and run migrations
npx prisma migrate dev --name init_postgres
```

#### Step 5: Update Cloud Run Deployment

The deploy script needs to connect to Cloud SQL. Update `backend/deploy.ps1` deployment command to include Cloud SQL connection:

```powershell
cd backend

# Get connection name first
$CONN_NAME = (gcloud sql instances describe mcp-registry-db --format="value(connectionName)")

# Deploy with Cloud SQL connection
.\deploy.ps1
```

But first, update the deploy script to add `--add-cloudsql-instances` flag. Or manually deploy:

```powershell
# After running deploy.ps1 to build image, manually update the service:
gcloud run services update mcp-registry-backend `
    --region us-central1 `
    --add-cloudsql-instances $CONN_NAME `
    --update-env-vars DATABASE_URL="postgresql://postgres:PASSWORD@/mcp_registry?host=/cloudsql/$CONN_NAME"
```

### Option 2: Temporary Fix - Make Backend Work Without Database

If you need a quick workaround while setting up Cloud SQL, you can modify the backend to handle missing database gracefully. But **this will break database-dependent features**.

## Immediate Next Steps

1. **Create Cloud SQL instance** (5 minutes)
2. **Update .env and schema.prisma** (2 minutes)
3. **Run migrations** (1 minute)
4. **Redeploy backend** (5 minutes)

**Total time: ~15 minutes**

## Verify After Fix

```powershell
# Test backend health
Invoke-WebRequest -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/health" -UseBasicParsing

# Should return 200 OK
```

## Frontend Configuration

Make sure your frontend (Vercel/Amplify) has:
- `NEXT_PUBLIC_API_URL` = `https://mcp-registry-backend-554655392699.us-central1.run.app`

This should already be set, but verify in:
- Vercel: Settings → Environment Variables
- Amplify: App settings → Environment variables

