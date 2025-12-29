# Fix DATABASE_URL Format

## Current (Incorrect) Format:

```
postgresql://postgres:gLTiCaO4qxQIHchmk7Dt@/slashmcp:us-central1:mcp-registry-db/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db
```

## Correct Format:

The connection name should be in the `?host=` parameter, not in the path. The path should only have the database name.

**Correct DATABASE_URL:**

```
postgresql://postgres:gLTiCaO4qxQIHchmk7Dt@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db
```

## Update Your .env File:

Replace line 5 in `backend/.env` with:

```env
DATABASE_URL="postgresql://postgres:gLTiCaO4qxQIHchmk7Dt@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db"
```

## What Changed:

- ❌ Removed: `/slashmcp:us-central1:mcp-registry-db` from the path (before `/mcp_registry`)
- ✅ Kept: `/mcp_registry` as the database name in the path
- ✅ Kept: `?host=/cloudsql/slashmcp:us-central1:mcp-registry-db` as the connection parameter

## Format Breakdown:

```
postgresql://[USER]:[PASSWORD]@/[DATABASE_NAME]?host=/cloudsql/[CONNECTION_NAME]
```

- User: `postgres`
- Password: `gLTiCaO4qxQIHchmk7Dt`
- Database: `mcp_registry`
- Connection: `slashmcp:us-central1:mcp-registry-db`

