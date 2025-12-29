# Fix: Can't Reach Database Server

## Problem
The connection is being rejected because your local IP address isn't in the authorized networks.

## Solution Options

### Option 1: Add Your IP to Authorized Networks (Quick)

1. **Find your current public IP**:
   - Go to: https://whatismyipaddress.com/
   - Copy your public IP address

2. **Add to Cloud SQL authorized networks**:
   - Go to Cloud SQL Console → Connections
   - Click "Add a network"
   - Enter your public IP (or use `0.0.0.0/0` for all IPs - less secure but works for testing)
   - Click "Done"
   - Click "Save"

3. **Try migrations again**:
   ```powershell
   cd backend
   npx prisma migrate deploy
   ```

### Option 2: Run Migrations in Cloud Run (Recommended)

Create a Cloud Run job to run migrations:

1. **Go to Cloud Run Jobs**: https://console.cloud.google.com/run/jobs?project=554655392699

2. **Create Job**:
   - Name: `mcp-registry-migrate`
   - Container image: `gcr.io/554655392699/mcp-registry-backend`
   - Command: `npx prisma migrate deploy`
   - Environment variables: Add `DATABASE_URL` with Unix socket format

3. **Run the job** to execute migrations

### Option 3: Use Cloud SQL Proxy (More Secure)

Set up Cloud SQL Proxy locally, but this is more complex.

## Quick Fix: Add IP to Authorized Networks

The fastest way is Option 1 - add your current IP (or `0.0.0.0/0` temporarily) to authorized networks, then run migrations.

