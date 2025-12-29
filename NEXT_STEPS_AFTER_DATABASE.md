# Next Steps: Database Exists ✅

Great! Your database `mcp_registry` already exists. Now continue with:

## Step 1: Get Connection Name

1. Click **"Overview"** in the left sidebar (or go back to the instance overview)
2. Find **"Connection name"** 
   - Should be: `554655392699:us-central1:mcp-registry-db`
   - **Copy this** - you'll need it for the next steps!

## Step 2: Connect Cloud Run to Cloud SQL

1. **Go to Cloud Run Console**: 
   https://console.cloud.google.com/run/detail/us-central1/mcp-registry-backend?project=554655392699

2. Click **"Edit & Deploy New Revision"** (top right)

3. Click the **"Connections"** tab

4. Scroll down to **"Cloud SQL connections"** section

5. Click **"Add Connection"** button

6. Select: **`mcp-registry-db`** from the dropdown

7. Click **"Deploy"** at the bottom
   - ⏱️ Wait 2-3 minutes for deployment

## Step 3: Update Backend Configuration Files

### A. Update Prisma Schema

Edit `backend/prisma/schema.prisma`:

Find line 6 and change:
```prisma
provider = "sqlite"
```

To:
```prisma
provider = "postgresql"
```

### B. Update Backend .env

Edit `backend/.env` file:

Add or update this line:
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@/mcp_registry?host=/cloudsql/554655392699:us-central1:mcp-registry-db"
```

Replace:
- `YOUR_PASSWORD` with your Cloud SQL root password (the one you set when creating the instance)
- `554655392699:us-central1:mcp-registry-db` with your actual connection name

## Step 4: Generate Prisma Client and Run Migrations

Open PowerShell and run:

```powershell
cd backend

# Generate Prisma client for PostgreSQL
npx prisma generate

# Run migrations (creates tables in your database)
npx prisma migrate deploy
```

## Step 5: Update Cloud Run Environment Variable

After migrations complete:

1. Go back to **Cloud Run Console**
2. Click **"Edit & Deploy New Revision"**
3. Go to **"Variables & Secrets"** tab
4. Under **"Environment variables"**, click **"Add Variable"**
5. Add:
   - **Name**: `DATABASE_URL`
   - **Value**: `postgresql://postgres:YOUR_PASSWORD@/mcp_registry?host=/cloudsql/554655392699:us-central1:mcp-registry-db`
6. Click **"Deploy"**

## Step 6: Test It!

```powershell
# Test health endpoint
Invoke-WebRequest -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/health"

# Test servers endpoint (should work now!)
Invoke-WebRequest -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers"
```

## Summary

✅ Database `mcp_registry` exists  
⏭️ Next: Get connection name → Connect Cloud Run → Update files → Migrate → Deploy

