# Find Cloud SQL Public IP Address

## Where to Find It

The Public IP address is shown on the **Overview** page of your Cloud SQL instance, not the Connections/Edit page.

### Steps:

1. **Go back to Overview**:
   - Click the back arrow or click **"Overview"** in the left sidebar
   - Or go directly to: https://console.cloud.google.com/sql/instances/mcp-registry-db?project=554655392699

2. **Look for "Public IP"** section:
   - It should show an IP address like: `34.123.45.67`
   - This is what you need for the DATABASE_URL

### Alternative: Check Authorized Networks

If you can't find it on Overview, the authorized network you see (`35.239.196.223`) might be a hint, but you need the actual Public IP address of the instance itself, not the authorized network IP.

## Once You Have the Public IP:

Update `backend/.env`:
```env
DATABASE_URL="postgresql://postgres:gLTiCaO4qxQIHchmk7Dt@PUBLIC_IP:5432/mcp_registry"
```

Then run migrations:
```powershell
cd backend
npx prisma migrate deploy
```

