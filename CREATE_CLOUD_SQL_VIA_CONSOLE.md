# Create Cloud SQL via Console (Easier than CLI)

Since you're having gcloud permission issues, use the Google Cloud Console UI instead.

## Step 1: Create Cloud SQL Instance

1. **Go to Cloud SQL Console**: https://console.cloud.google.com/sql/instances?project=554655392699

2. **Click "Create Instance"**

3. **Choose PostgreSQL**:
   - Click "Choose PostgreSQL"

4. **Configure Instance**:
   - **Instance ID**: `mcp-registry-db`
   - **Database version**: PostgreSQL 15
   - **Region**: `us-central1` (same as Cloud Run)
   - **Zone**: Choose any zone in us-central1
   - **Configuration**: Choose "Development" or "Sandbox"
   - **Machine type**: `db-f1-micro` (free tier eligible, ~$7/month)
   - **Storage**: 
     - Type: SSD
     - Capacity: 20 GB (minimum)

5. **Set Root Password**:
   - Enter a secure password (you used: `Aardvark41+`)
   - **Save this password** - you'll need it!

6. **Click "Create Instance"**
   - This takes 5-10 minutes to provision

## Step 2: Create Database

Once instance is created:

1. **Click on your instance** (`mcp-registry-db`)

2. **Go to "Databases" tab**

3. **Click "Create Database"**

4. **Database name**: `mcp_registry`

5. **Click "Create"**

## Step 3: Get Connection Name

1. In your instance details, you'll see **"Connection name"**
2. It will look like: `554655392699:us-central1:mcp-registry-db`
3. **Copy this** - you'll need it!

## Step 4: Update Backend Configuration

Once you have the connection name, update your backend:

1. **Edit `backend/.env`**:
   ```env
   DATABASE_URL="postgresql://postgres:Aardvark41+@/mcp_registry?host=/cloudsql/554655392699:us-central1:mcp-registry-db"
   ```
   
   Replace:
   - `Aardvark41+` with your actual password
   - `554655392699:us-central1:mcp-registry-db` with your actual connection name

2. **Edit `backend/prisma/schema.prisma`**:
   ```prisma
   datasource db {
     provider = "postgresql"  // Change from "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

## Step 5: Generate Prisma Client and Migrate

```powershell
cd backend

# Generate Prisma client for PostgreSQL
npx prisma generate

# Run migrations (creates tables)
npx prisma migrate deploy
```

## Step 6: Connect Cloud Run to Cloud SQL

You need to connect your Cloud Run service to Cloud SQL:

1. **Go to Cloud Run Console**: https://console.cloud.google.com/run/detail/us-central1/mcp-registry-backend?project=554655392699

2. **Click "Edit & Deploy New Revision"**

3. **Go to "Connections" tab**

4. **Under "Cloud SQL connections"**, click "Add Connection"

5. **Select your instance**: `mcp-registry-db`

6. **Click "Deploy"**

## Step 7: Redeploy Backend

After connecting Cloud SQL, redeploy with the database URL:

```powershell
cd backend
.\deploy.ps1 -SetEnvVars
```

Or update manually:
```powershell
gcloud run services update mcp-registry-backend `
    --region us-central1 `
    --update-env-vars DATABASE_URL="postgresql://postgres:Aardvark41+@/mcp_registry?host=/cloudsql/554655392699:us-central1:mcp-registry-db"
```

## That's It!

After these steps, your backend should be able to connect to the database!

