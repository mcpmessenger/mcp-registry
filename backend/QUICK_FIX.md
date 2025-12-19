# Quick Fix for SQLite Database Lock Issue

## Problem
SQLite database operations are timing out due to OneDrive sync interference.

## Immediate Solution: Use PostgreSQL (Recommended)

PostgreSQL doesn't have file locking issues and works better for development.

### Option 1: Use Docker PostgreSQL (Easiest)

```powershell
# Start PostgreSQL in Docker
docker run --name mcp-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mcp_registry -p 5432:5432 -d postgres:15

# Update .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mcp_registry"
```

Then update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Run migration:
```powershell
npm run migrate
```

### Option 2: Use Local PostgreSQL Installation

1. Install PostgreSQL from https://www.postgresql.org/download/windows/
2. Create database: `createdb mcp_registry`
3. Update `.env` with connection string
4. Update `schema.prisma` provider to `postgresql`
5. Run migration

### Option 3: Use SQLite with Different Location

Try using Windows temp directory:

```env
DATABASE_URL="file:C:/Users/senti/AppData/Local/Temp/mcp-registry/dev.db"
```

Create the directory first:
```powershell
New-Item -ItemType Directory -Force -Path "$env:LOCALAPPDATA\Temp\mcp-registry"
```

## Alternative: Skip Database for Now

If you just want to test the API without database:

1. Comment out database operations temporarily
2. Use mock data
3. Test endpoints that don't require database

## Why This Happens

OneDrive sync can lock SQLite database files, causing timeouts. PostgreSQL uses a server process instead of file locking, avoiding this issue.
