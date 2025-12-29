# Fix Backend Database Error

## Problem
You're getting: `PrismaClientInitializationError` - This means the backend can't connect to the database.

## Root Cause
The backend is deployed to Cloud Run but `DATABASE_URL` is set to `file:./dev.db` (SQLite), which doesn't work on Cloud Run because:
- Cloud Run containers are stateless
- File system is ephemeral (files are lost when container stops)
- Multiple instances can't share the same file

## Solution Options

### Option 1: Use Cloud SQL (PostgreSQL) - Recommended for Production

#### Step 1: Create Cloud SQL Instance

```powershell
# In PowerShell (run in admin terminal)
gcloud sql instances create mcp-registry-db `
    --database-version=POSTGRES_15 `
    --tier=db-f1-micro `
    --region=us-central1 `
    --root-password=YOUR_SECURE_PASSWORD

# Create database
gcloud sql databases create mcp_registry --instance=mcp-registry-db

# Get connection name
gcloud sql instances describe mcp-registry-db --format="value(connectionName)"
# Output: PROJECT_ID:REGION:INSTANCE_NAME
```

#### Step 2: Update Backend .env

Edit `backend/.env`:

```env
# Use Cloud SQL connection string
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@/mcp_registry?host=/cloudsql/PROJECT_ID:REGION:mcp-registry-db"
```

**Important**: Replace:
- `YOUR_PASSWORD` with the password you set
- `PROJECT_ID:REGION:mcp-registry-db` with your actual connection name

#### Step 3: Update Prisma Schema

Edit `backend/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"  // Change from "sqlite"
  url      = env("DATABASE_URL")
}
```

#### Step 4: Run Migrations and Redeploy

```powershell
cd backend

# Generate Prisma client for PostgreSQL
npx prisma generate

# Run migrations (will create tables)
npx prisma migrate deploy

# Redeploy backend
.\deploy.ps1
```

### Option 2: Use SQLite with Persistent Volume (Temporary/Fallback)

For a quick test, you can mount a Cloud Storage bucket, but **this is NOT recommended for production**:

```powershell
# This is complex and not recommended
# Better to use Cloud SQL instead
```

### Option 3: Disable Database Temporarily (Testing Only)

If you just want to test the deployment without database:

1. Update backend code to handle missing database gracefully
2. But this will break features that need database

**⚠️ Not recommended - use Cloud SQL instead**

## Quick Fix Steps (Cloud SQL)

```powershell
# 1. Create Cloud SQL instance (one-time setup)
gcloud sql instances create mcp-registry-db --database-version=POSTGRES_15 --tier=db-f1-micro --region=us-central1 --root-password=YOUR_PASSWORD

# 2. Create database
gcloud sql databases create mcp_registry --instance=mcp-registry-db

# 3. Get connection name
$CONN_NAME = (gcloud sql instances describe mcp-registry-db --format="value(connectionName)")
Write-Host "Connection name: $CONN_NAME"

# 4. Update backend/.env
# DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@/mcp_registry?host=/cloudsql/$CONN_NAME"

# 5. Update schema.prisma to use postgresql

# 6. Generate and migrate
cd backend
npx prisma generate
npx prisma migrate deploy

# 7. Redeploy
.\deploy.ps1
```

## Also Check Frontend Configuration

Make sure Vercel/Amplify has:
- `NEXT_PUBLIC_API_URL` = `https://mcp-registry-backend-554655392699.us-central1.run.app`

Not `http://localhost:3001`!

