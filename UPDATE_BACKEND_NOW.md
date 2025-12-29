# Update Backend Configuration with Correct Connection Name

## Connection Name Found! ✅
`slashmcp:us-central1:mcp-registry-db`

## Step 1: Update backend/.env

Edit `backend/.env` file and add/update:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db"
```

**Replace `YOUR_PASSWORD`** with your Cloud SQL root password (the one you set when creating the instance).

## Step 2: schema.prisma Already Updated ✅

I've already updated `backend/prisma/schema.prisma` to use PostgreSQL instead of SQLite.

## Step 3: Connect Cloud Run (Do This First!)

Before updating files, connect Cloud Run to Cloud SQL:

1. **Go to Cloud Run**: https://console.cloud.google.com/run/detail/us-central1/mcp-registry-backend?project=554655392699

2. Click **"Edit & Deploy New Revision"**

3. Go to **"Connections"** tab

4. Under **"Cloud SQL connections"**, click **"Add Connection"**

5. Select: **`mcp-registry-db`**

6. Click **"Deploy"**

⏱️ Wait 2-3 minutes for deployment

## Step 4: Generate Prisma Client and Migrate

After Cloud Run is connected:

```powershell
cd backend

# Generate Prisma client for PostgreSQL
npx prisma generate

# Run migrations (creates tables)
npx prisma migrate deploy
```

## Step 5: Update Cloud Run Environment Variable

1. Go to Cloud Run Console
2. Click **"Edit & Deploy New Revision"**
3. Go to **"Variables & Secrets"** tab
4. Click **"Add Variable"** under Environment variables
5. Add:
   - **Name**: `DATABASE_URL`
   - **Value**: `postgresql://postgres:YOUR_PASSWORD@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db`
6. Click **"Deploy"**

## Summary

✅ Connection name: `slashmcp:us-central1:mcp-registry-db`  
✅ schema.prisma updated to PostgreSQL  
⏭️ Next: Connect Cloud Run → Update .env → Migrate → Set env var → Deploy

