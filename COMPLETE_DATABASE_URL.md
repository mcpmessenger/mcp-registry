# Complete DATABASE_URL for Your Backend

## Connection Details We Have:

- **Connection name**: `slashmcp:us-central1:mcp-registry-db` ✅
- **Database name**: `mcp_registry` ✅
- **Username**: `postgres` ✅
- **Password**: Need to confirm or reset

## DATABASE_URL Format:

```
postgresql://postgres:PASSWORD@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db
```

## Quick Steps:

### If You Remember the Password:

1. Replace `PASSWORD` in the URL above with your actual password
2. Add to `backend/.env`:
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db"
   ```

### If You Don't Remember the Password:

**Reset it in Cloud Console:**

1. Go to: https://console.cloud.google.com/sql/instances/mcp-registry-db/users?project=554655392699
2. Click on **"postgres"** user
3. Click **"Reset password"**
4. Enter a new password (remember it!)
5. Use this password in the DATABASE_URL

## Then Update Your .env File:

Replace line 5 in `backend/.env`:
- **Current**: `DATABASE_URL="file:./dev.db"`
- **New**: `DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db"`

