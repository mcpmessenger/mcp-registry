# Update DATABASE_URL with New Password

## After Resetting Password

You've reset the postgres password. Now you need to update DATABASE_URL in two places:

### Step 1: Update Local .env File

Edit `backend/.env` and update line 5:

**Change:**
```env
DATABASE_URL="postgresql://postgres:OLD_PASSWORD@34.56.74.73:5432/mcp_registry"
```

**To:**
```env
DATABASE_URL="postgresql://postgres:YOUR_NEW_PASSWORD@34.56.74.73:5432/mcp_registry"
```

Replace `YOUR_NEW_PASSWORD` with the password you just set.

### Step 2: Update Cloud Run Environment Variable

1. Go to Cloud Run Console: https://console.cloud.google.com/run/detail/us-central1/mcp-registry-backend?project=554655392699

2. Click **"Edit & Deploy New Revision"**

3. Go to **"Variables & Secrets"** tab

4. Find `DATABASE_URL` in the environment variables list

5. Click on it to edit, or delete and add new:
   - **Name**: `DATABASE_URL`
   - **Value**: `postgresql://postgres:YOUR_NEW_PASSWORD@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db`
   - (Use Unix socket format for Cloud Run, not TCP)

6. Click **"Deploy"**

### Step 3: Run Migrations

After updating local .env:

```powershell
cd backend
npx prisma migrate deploy
```

## Important

- **Local .env**: Use TCP format with public IP: `postgresql://postgres:PASSWORD@34.56.74.73:5432/mcp_registry`
- **Cloud Run**: Use Unix socket format: `postgresql://postgres:PASSWORD@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db`

