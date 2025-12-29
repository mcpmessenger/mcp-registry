# Fix CORS to Support Multiple Domains

## Problem

The CORS code only checked for exact match, so comma-separated domains wouldn't work. I've updated the code to handle multiple domains.

## What I Fixed

Updated `backend/src/server.ts` to parse comma-separated CORS origins instead of just doing exact match.

## Now Update Your .env File

Edit `backend/.env` and update CORS_ORIGIN:

**Remove the path** (no `/registry`) and **add Amplify domain**:

```env
CORS_ORIGIN="https://slashmcp.com,https://main.d2cddqmnkv63mg.amplifyapp.com,https://mcp-registry-sentilabs.vercel.app"
```

**Or if you use www subdomain:**
```env
CORS_ORIGIN="https://slashmcp.com,https://www.slashmcp.com,https://main.d2cddqmnkv63mg.amplifyapp.com,https://mcp-registry-sentilabs.vercel.app"
```

## Then Deploy

After updating `.env`:

```powershell
cd backend
.\deploy.ps1
```

This will:
1. Build the updated code with the CORS fix
2. Deploy to Cloud Run
3. Update CORS_ORIGIN environment variable

## Verify

After deployment, refresh your Amplify site - the CORS error should be gone!

