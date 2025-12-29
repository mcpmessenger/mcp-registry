# DATABASE_URL Format for Cloud SQL

## Your DATABASE_URL

```
postgresql://postgres:YOUR_PASSWORD@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db
```

## Components We Have:

✅ **Username**: `postgres` (default PostgreSQL user)  
✅ **Database name**: `mcp_registry`  
✅ **Connection name**: `slashmcp:us-central1:mcp-registry-db`  

❓ **Password**: You need to use the password you set when creating the Cloud SQL instance

## Password Options:

If you remember setting the password when creating the instance, use that. Common options:
- The password you set in the console when creating the instance
- If you used one earlier, it might be: `Aardvark41+` (you mentioned this earlier)

## How to Find/Reset Password:

### Option 1: Check if you remember it
Think back to when you created the Cloud SQL instance - what password did you set?

### Option 2: Reset password in Cloud Console

1. Go to Cloud SQL Console: https://console.cloud.google.com/sql/instances/mcp-registry-db?project=554655392699
2. Click on your instance
3. Go to **"Users"** tab in the left sidebar
4. Click on **"postgres"** user
5. Click **"Reset password"**
6. Set a new password
7. Use this new password in the DATABASE_URL

## Final DATABASE_URL (replace YOUR_PASSWORD):

```
postgresql://postgres:YOUR_PASSWORD@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db
```

## Example (if password is "Aardvark41+"):

```
DATABASE_URL="postgresql://postgres:Aardvark41+@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db"
```

