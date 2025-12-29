# Update .env for Cloud Run Deployment

## Current Issues in Your .env:

1. **DATABASE_URL** - Uses local Docker format (`db:5432`)
   - Should use Cloud SQL Unix socket format

2. **CORS_ORIGIN** - Only has Vercel domain with path
   - Should include all domains without paths

## Required Changes:

### 1. Update DATABASE_URL:

**Change FROM:**
```
DATABASE_URL="postgresql://postgres:darklord@db:5432/app_registry?sslmode=disable&search_path=control_app_registry_db"
```

**Change TO:**
```
DATABASE_URL="postgresql://postgres:Aardvark41%2B@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db"
```

**Note:** 
- Password should be `Aardvark41%2B` (URL-encoded + sign)
- Uses Unix socket connection (`/cloudsql/...`)
- Database name: `mcp_registry`

### 2. Update CORS_ORIGIN:

**Change FROM:**
```
CORS_ORIGIN="https://app.registry.vercel.app/registry"
```

**Change TO:**
```
CORS_ORIGIN="https://slashmcp.com,https://main.d2cddqmnkv63mg.amplifyapp.com,https://mcp-registry-sentilabs.vercel.app"
```

**Note:**
- Remove the `/registry` path
- Add all three domains separated by commas
- No spaces after commas

## Other Notes:

- ✅ PORT=8080 is correct
- ✅ NODE_ENV=production is correct
- Make sure all your API keys are filled in

## After Updating:

Save the file and deploy:
```bash
./deploy.sh
```

