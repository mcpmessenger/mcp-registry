# Verify DATABASE_URL Format

## Error Message:
"empty host in database URL"

This suggests the DATABASE_URL format might need adjustment for Prisma.

## Current Format (What We Set):
```
postgresql://postgres:gLTiCaO4qxQIHchmk7Dt@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db
```

## For Cloud SQL Unix Socket Connection:

The format should be correct, but let's verify. For Cloud Run connecting to Cloud SQL via Unix socket, the format is:

```
postgresql://USER:PASSWORD@/DATABASE?host=/cloudsql/CONNECTION_NAME
```

## Alternative: Use TCP Connection (For Testing Locally)

If you're running migrations locally (not in Cloud Run), you might need to use the public IP connection instead:

1. **Get Public IP from Cloud SQL Console:**
   - Go to Cloud SQL instance
   - Find the "Public IP" address
   - Or enable public IP if not enabled

2. **Use TCP Connection Format:**
   ```
   postgresql://postgres:PASSWORD@PUBLIC_IP:5432/mcp_registry
   ```

## For Cloud Run (Unix Socket - Keep Current Format:

For Cloud Run, the Unix socket format we have should work:
```
postgresql://postgres:gLTiCaO4qxQIHchmk7Dt@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db
```

## Solution: Run Migrations in Cloud Run Instead

Since you're running migrations locally, you have two options:

### Option 1: Enable Public IP and Use TCP (Quick Fix)

1. Go to Cloud SQL Console
2. Enable Public IP
3. Update DATABASE_URL to use TCP:
   ```
   postgresql://postgres:gLTiCaO4qxQIHchmk7Dt@PUBLIC_IP:5432/mcp_registry
   ```

### Option 2: Run Migrations in Cloud Run (Recommended)

Create a Cloud Run job to run migrations, or run them after deployment.

## Quick Test: Check .env File

Make sure your `backend/.env` has the DATABASE_URL on a single line with no line breaks or extra characters.

