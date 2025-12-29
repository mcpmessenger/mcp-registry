# Prisma Permission Error Fix

## Problem
Docker build was failing with:
```
sh: 1: prisma: Permission denied
npm error code 127
```

## Solution
Updated Dockerfile to:
1. Use `npm install --ignore-scripts` to skip postinstall scripts (which use npx)
2. Manually run Prisma generate after ensuring execute permissions
3. Added fallback methods to run Prisma generate (direct node path, binary path, npm script)

## Changes Made

### Builder Stage:
- Changed `npm install` to `npm install --ignore-scripts`
- Added `chmod +x node_modules/.bin/*` to ensure execute permissions
- Updated Prisma generate to try multiple methods

### Runner Stage:
- Changed `npm install --only=production` to `npm install --only=production --ignore-scripts`
- Added `chmod +x node_modules/.bin/*` to ensure execute permissions
- Updated Prisma generate with fallback methods

## Next Step
Deploy again - the build should now succeed!

```powershell
cd backend
.\deploy.ps1
```

