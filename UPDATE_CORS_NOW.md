# Update CORS_ORIGIN for Amplify

## Current Issue

Your CORS_ORIGIN has a path in it: `https://mcp-registry-sentilabs.vercel.app/registry`
- ❌ This is wrong - CORS_ORIGIN should only include the domain, not the path

## Domains to Include

Based on your setup:
1. **Amplify domain**: `https://main.d2cddqmnkv63mg.amplifyapp.com`
2. **Production domain**: `https://slashmcp.com` (and `https://www.slashmcp.com` if you use www)
3. **Vercel domain**: `https://mcp-registry-sentilabs.vercel.app` (without `/registry` path)

## Fix: Update backend/.env

Edit `backend/.env` and update the CORS_ORIGIN line:

**Current (wrong):**
```env
CORS_ORIGIN="https://mcp-registry-sentilabs.vercel.app/registry"
```

**New (correct):**
```env
CORS_ORIGIN="https://slashmcp.com,https://main.d2cddqmnkv63mg.amplifyapp.com,https://mcp-registry-sentilabs.vercel.app"
```

**Or if you also use www:**
```env
CORS_ORIGIN="https://slashmcp.com,https://www.slashmcp.com,https://main.d2cddqmnkv63mg.amplifyapp.com,https://mcp-registry-sentilabs.vercel.app"
```

## Important Notes

- ❌ **No paths** in CORS_ORIGIN (remove `/registry`)
- ✅ **Separate with commas** (no spaces)
- ✅ **Include https://** prefix

## Update Cloud Run

After updating `.env`, update Cloud Run:

1. Go to Cloud Run Console
2. Edit & Deploy New Revision
3. Variables & Secrets tab
4. Update `CORS_ORIGIN` with the same value (comma-separated domains)
5. Deploy

Or use the deploy script:
```powershell
cd backend
.\deploy.ps1 -SetEnvVars
```

