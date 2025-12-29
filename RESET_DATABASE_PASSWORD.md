# Reset Cloud SQL Postgres Password

## Problem
Authentication failed - the password `gLTiCaO4qxQIHchmk7Dt` doesn't seem to be correct.

## Solution: Reset Password

### Step 1: Go to Cloud SQL Users Page

1. Go to Cloud SQL Console: https://console.cloud.google.com/sql/instances/mcp-registry-db?project=554655392699

2. Click **"Users"** in the left sidebar

3. You should see the **"postgres"** user listed

### Step 2: Reset Password

1. Click on the **"postgres"** user (or click the 3-dot menu next to it)

2. Click **"Reset password"** or **"Change password"**

3. Enter a **new password** (make it secure!)
   - Example: `NewSecurePassword123!`
   - **Write it down** - you'll need it!

4. Click **"OK"** or **"Save"**

### Step 3: Update DATABASE_URL

After resetting, update your `backend/.env` file:

```env
DATABASE_URL="postgresql://postgres:NEW_PASSWORD@34.56.74.73:5432/mcp_registry"
```

Replace `NEW_PASSWORD` with the password you just set.

### Step 4: Update Cloud Run Environment Variable Too

After resetting, also update the DATABASE_URL in Cloud Run:

1. Go to Cloud Run Console
2. Edit & Deploy New Revision
3. Variables & Secrets tab
4. Update `DATABASE_URL` environment variable with the new password

### Step 5: Try Migrations Again

```powershell
cd backend
npx prisma migrate deploy
```

## Alternative: Use Current Password

If you remember setting a different password when creating the instance, use that instead of resetting.

