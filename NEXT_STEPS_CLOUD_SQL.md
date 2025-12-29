# Next Steps: Cloud SQL Setup (Instance Created ✅)

Your Cloud SQL instance `mcp-registry-db` is running! Now do these steps:

## Step 1: Create Database

1. In the left sidebar, click **"Databases"**
2. Click **"Create Database"** button (top)
3. **Database name**: `mcp_registry`
4. Click **"Create"**

## Step 2: Get Connection Name

1. On the Overview page, find **"Connection name"**
   - It should be: `554655392699:us-central1:mcp-registry-db`
   - **Copy this** - you'll need it!

   OR

2. Look at the top of the page in the instance details - it's usually shown there

## Step 3: Connect Cloud Run to Cloud SQL

1. **Go to Cloud Run**: https://console.cloud.google.com/run/detail/us-central1/mcp-registry-backend?project=554655392699

2. Click **"Edit & Deploy New Revision"** (top right)

3. Go to **"Connections"** tab

4. Scroll to **"Cloud SQL connections"** section

5. Click **"Add Connection"**

6. Select: **`mcp-registry-db`**

7. Click **"Deploy"** (at bottom)

   ⏱️ Wait for deployment to complete (2-3 minutes)

## Step 4: Update Backend Configuration Files

After Cloud SQL is connected, update these files:

### A. Update `backend/prisma/schema.prisma`

Change line 6 from:
```prisma
provider = "sqlite"
```

To:
```prisma
provider = "postgresql"
```

### B. Update `backend/.env`

Add/update this line (replace with your actual connection name):
```env
DATABASE_URL="postgresql://postgres:Aardvark41+@/mcp_registry?host=/cloudsql/554655392699:us-central1:mcp-registry-db"
```

Replace:
- `Aardvark41+` with your actual root password
- `554655392699:us-central1:mcp-registry-db` with your actual connection name

## Step 5: Generate Prisma Client and Run Migrations

```powershell
cd backend

# Generate Prisma client for PostgreSQL
npx prisma generate

# Run migrations (creates tables in database)
npx prisma migrate deploy
```

## Step 6: Update Cloud Run with DATABASE_URL

After migrations run successfully, set the environment variable in Cloud Run:

1. Go back to Cloud Run Console
2. Click **"Edit & Deploy New Revision"**
3. Go to **"Variables & Secrets"** tab
4. Under **"Environment variables"**, click **"Add Variable"**
5. Add:
   - **Name**: `DATABASE_URL`
   - **Value**: `postgresql://postgres:Aardvark41+@/mcp_registry?host=/cloudsql/554655392699:us-central1:mcp-registry-db`
6. Click **"Deploy"**

## Step 7: Verify It Works

Test the backend:
```powershell
# Test health endpoint
Invoke-WebRequest -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/health"

# Should return: {"status":"ok",...}
```

Test the servers endpoint:
```powershell
Invoke-WebRequest -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers"
```

Should return servers list (may be empty if no data yet, but shouldn't error).

## Summary Checklist

- [x] Cloud SQL instance created
- [ ] Database `mcp_registry` created
- [ ] Connection name copied
- [ ] Cloud Run connected to Cloud SQL
- [ ] `schema.prisma` updated to `postgresql`
- [ ] `backend/.env` updated with DATABASE_URL
- [ ] Prisma client generated
- [ ] Migrations run
- [ ] Cloud Run DATABASE_URL env var set
- [ ] Backend tested and working

## Current Status

✅ **Step 1-2**: Create database and get connection name (do this now!)

