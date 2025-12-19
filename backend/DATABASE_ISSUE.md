# Database Setup Issue - SQLite Locked

## Current Problem
SQLite database operations are timing out with "database is locked" errors. This is a known issue when using SQLite in OneDrive-synced directories on Windows.

## Root Cause
OneDrive's file sync mechanism interferes with SQLite's file locking, causing persistent timeout errors.

## Recommended Solution: Use PostgreSQL

PostgreSQL uses a server process instead of file locking, completely avoiding this issue.

### Quick Setup with Docker (5 minutes)

1. **Install Docker Desktop** (if not already installed):
   - Download from: https://www.docker.com/products/docker-desktop

2. **Start PostgreSQL container:**
   ```powershell
   docker run --name mcp-postgres `
     -e POSTGRES_PASSWORD=postgres `
     -e POSTGRES_DB=mcp_registry `
     -p 5432:5432 `
     -d postgres:15
   ```

3. **Update `.env` file:**
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mcp_registry"
   ```

4. **Update `prisma/schema.prisma`:**
   Change line 9 from:
   ```prisma
   provider = "sqlite"
   ```
   To:
   ```prisma
   provider = "postgresql"
   ```

5. **Run migration:**
   ```powershell
   npm run migrate
   ```

6. **Seed the database:**
   ```powershell
   npm run seed
   ```

### Alternative: Use Local PostgreSQL

1. Install PostgreSQL from: https://www.postgresql.org/download/windows/
2. Create database: `createdb mcp_registry`
3. Update `.env` with your PostgreSQL connection string
4. Update `schema.prisma` provider to `postgresql`
5. Run migration

## Why PostgreSQL is Better

- ✅ No file locking issues
- ✅ Better for production
- ✅ Supports concurrent connections
- ✅ More features (JSON, full-text search, etc.)
- ✅ Better performance

## If You Must Use SQLite

Try these workarounds:

1. **Move database outside OneDrive:**
   ```env
   DATABASE_URL="file:C:/Users/senti/AppData/Local/Temp/mcp-registry/dev.db"
   ```

2. **Pause OneDrive sync temporarily** while running migrations

3. **Use in-memory database for testing:**
   ```env
   DATABASE_URL="file::memory:?cache=shared"
   ```
   (Note: Data is lost when connection closes)

## Next Steps

1. Choose PostgreSQL (recommended) or try SQLite workarounds
2. Update `.env` and `schema.prisma` accordingly
3. Run `npm run migrate`
4. Run `npm run seed`
5. Start server with `npm start`
