# SQLite Database Timeout Troubleshooting

## Issue
SQLite database operations are timing out with error `P1008: Socket timeout`.

## Root Cause
OneDrive sync can interfere with SQLite file locking, causing timeouts when Prisma tries to access the database.

## Solutions

### Solution 1: Use Local Database Path (Recommended)

Update your `.env` file to use a local path that's NOT synced by OneDrive:

```env
# Use a local temp directory instead
DATABASE_URL="file:./data/dev.db"
```

Then create the directory:
```powershell
mkdir backend\data
```

### Solution 2: Use Absolute Local Path

```env
# Use Windows temp directory
DATABASE_URL="file:C:/Users/senti/AppData/Local/Temp/mcp-registry/dev.db"
```

### Solution 3: Exclude Database from OneDrive Sync

1. Right-click on `backend/prisma` folder
2. Select "Always keep on this device" in OneDrive settings
3. Or exclude `.db` files from OneDrive sync

### Solution 4: Use PostgreSQL for Development

Switch to PostgreSQL which doesn't have file locking issues:

1. Install PostgreSQL locally or use Docker
2. Update `.env`:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/mcp_registry"
   ```
3. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
4. Run migration: `npm run migrate`

## Quick Fix Script

Run this PowerShell script to set up a local database:

```powershell
cd backend

# Create local data directory
New-Item -ItemType Directory -Force -Path "data"

# Update .env (if it exists)
if (Test-Path ".env") {
    (Get-Content ".env") -replace 'DATABASE_URL="file:./dev.db"', 'DATABASE_URL="file:./data/dev.db"' | Set-Content ".env"
} else {
    @"
DATABASE_URL="file:./data/dev.db"
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
GOOGLE_VISION_API_KEY=
GOOGLE_GEMINI_API_KEY=
"@ | Out-File -FilePath ".env" -Encoding utf8
}

# Clean up old database
Remove-Item "prisma\dev.db*" -Force -ErrorAction SilentlyContinue

# Run migration
npm run migrate
```

## Verification

After applying a solution, verify it works:

```powershell
# Test database connection
npx prisma db push --skip-generate

# If successful, run seed
npm run seed
```
