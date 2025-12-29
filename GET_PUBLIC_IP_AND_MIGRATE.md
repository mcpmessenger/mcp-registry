# Get Public IP and Run Migrations

## Step 1: Get Public IP from Cloud SQL Console

1. Go to Cloud SQL Console: https://console.cloud.google.com/sql/instances/mcp-registry-db?project=554655392699
2. On the Overview page, find **"Public IP"** address
3. It should look like: `34.123.45.67` (example)
4. **Copy this IP address**

## Step 2: Update Local .env with Public IP Format

Once you have the public IP, update `backend/.env`:

**Change from:**
```env
DATABASE_URL="postgresql://postgres:gLTiCaO4qxQIHchmk7Dt@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db"
```

**To (TCP format with public IP):**
```env
DATABASE_URL="postgresql://postgres:gLTiCaO4qxQIHchmk7Dt@PUBLIC_IP:5432/mcp_registry"
```

Replace `PUBLIC_IP` with the actual IP address from step 1.

## Step 3: Run Migrations

```powershell
cd backend
npx prisma migrate deploy
```

## Step 4: Test Backend

After migrations complete:
```powershell
# Test servers endpoint
Invoke-WebRequest -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers"
```

## Important: Cloud Run Still Uses Unix Socket

- **Local `.env`**: Use TCP format with public IP for migrations
- **Cloud Run env var**: Keep Unix socket format (`?host=/cloudsql/...`) - it's already set correctly!

The Cloud Run service will continue using the Unix socket format you already set.

