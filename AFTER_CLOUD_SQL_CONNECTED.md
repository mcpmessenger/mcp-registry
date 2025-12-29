# After Cloud SQL Connected - Next Steps

## ✅ Cloud SQL Connection Added!

You've successfully connected Cloud SQL to Cloud Run. The connection `slashmcp:us-central1:mcp-registry-db` is shown.

## Step 1: Deploy the Revision

Click the **"Deploy"** button now!

⏱️ Wait 2-3 minutes for deployment to complete.

## Step 2: Update backend/.env

After deployment, edit `backend/.env` file and add:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db"
```

**Replace `YOUR_PASSWORD`** with your Cloud SQL root password.

## Step 3: Generate Prisma Client and Run Migrations

```powershell
cd backend

# Generate Prisma client for PostgreSQL
npx prisma generate

# Run migrations (creates tables in your database)
npx prisma migrate deploy
```

## Step 4: Set DATABASE_URL in Cloud Run

After migrations complete:

1. Go back to Cloud Run Console
2. Click **"Edit & Deploy New Revision"**
3. Go to **"Variables & Secrets"** tab
4. Under **"Environment variables"**, click **"Add Variable"**
5. Add:
   - **Name**: `DATABASE_URL`
   - **Value**: `postgresql://postgres:YOUR_PASSWORD@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db`
6. Click **"Deploy"**

## Step 5: Test It!

```powershell
# Test health endpoint
Invoke-WebRequest -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/health"

# Test servers endpoint (should work now without database error!)
Invoke-WebRequest -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers"
```

## Summary

✅ Cloud SQL connected to Cloud Run  
⏭️ Next: Click Deploy → Update .env → Migrate → Set env var → Test

