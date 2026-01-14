# Production Deployment Checklist

## Pre-Deployment

- [ ] **Database Setup** (choose one):
  - [ ] Supabase (recommended - 2 minutes, free) - [Guide](./DATABASE_SETUP.md)
  - [ ] Railway PostgreSQL (free tier)
  - [ ] Google Cloud SQL ($7/month)

- [ ] **Environment Variables Ready**:
  - [ ] `DATABASE_URL` - From your database provider
  - [ ] `GOOGLE_GEMINI_API_KEY` - Already in `.env` ✅
  - [ ] `OPENAI_API_KEY` - Already in `.env` ✅  
  - [ ] `CORS_ORIGIN` - Update to include Vercel URL

---

## Backend Deployment Steps

### 1. Set up Database (if not done)

**Quickest option - Supabase (2 minutes):**
```bash
# 1. Go to https://supabase.com and create project
# 2. Get DATABASE_URL from Settings → Database
# 3. Update backend/.env with the connection string
```

### 2. Update `.env` for Production

Edit `backend/.env`:
```env
# Replace this line:
DATABASE_URL="postgresql://postgres:postgres@localhost:54322/mcp_registry"

# With your production database URL from Supabase/Railway/Cloud SQL:
DATABASE_URL="postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres"

# Update CORS to include your Vercel domain:
CORS_ORIGIN="https://mcp-registry-sentilabs.vercel.app,https://slashmcp.com"

# Ensure orchestrators are disabled for initial deployment:
ENABLE_KAFKA=false
ENABLE_PULSAR=false
```

### 3. Run Database Migrations

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed  # Optional: adds official MCP servers
```

### 4. Deploy to Cloud Run

**Option A: Using gcloud CLI (if available)**
```bash
cd backend
chmod +x deploy-windows.ps1
./deploy-windows.ps1
```

**Option B: Using Google Cloud Console (if gcloud issues)**
1. Go to [Cloud Console](https://console.cloud.google.com/run?project=554655392699)
2. Select `mcp-registry-backend` service
3. Click **EDIT & DEPLOY NEW REVISION**
4. Under **Container** → Click **Deploy from source repository** 
5. Connect to GitHub: `mcpmessenger/mcp-registry` 
6. Branch: `main`
7. Build configuration: `Dockerfile` in `backend/` directory
8. Under **Variables & Secrets**:
   - Add `DATABASE_URL`
   - Add `GOOGLE_GEMINI_API_KEY`  
   - Add `OPENAI_API_KEY`
   - Add `CORS_ORIGIN`
   - Set `NODE_ENV=production`
   - Set `ENABLE_PULSAR=false`
   - Set `ENABLE_KAFKA=false`
9. Click **DEPLOY**

### 5. Verify Backend

```bash
# Health check
curl https://mcp-registry-backend-554655392699.us-central1.run.app/health

# List servers
curl https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers
```

---

## Frontend Deployment Steps

### 1. Update Local `.env.local` (for local dev)

``` bash
cd c:\Users\senti\OneDrive\Desktop\mcp-registry
echo NEXT_PUBLIC_API_URL=https://mcp-registry-backend-554655392699.us-central1.run.app > .env.local
```

### 2. Update Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project: `mcp-registry-sentilabs`
3. Go to **Settings** → **Environment Variables**
4. Add/Update:
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://mcp-registry-backend-554655392699.us-central1.run.app`
   - **Environment**: Production (and Preview)
5. Click **Save**

### 3. Trigger Redeployment

```bash
# Commit any pending changes
git add .
git commit -m "Update API URL for production deployment"
git push origin main
```

Or manually redeploy in Vercel Dashboard:
1. Go to **Deployments** tab
2. Click **...** on latest deployment
3. Click **Redeploy**

---

## Post-Deployment Verification

### Backend Tests

- [ ] Health check responds:
  ```bash
  curl https://mcp-registry-backend-554655392699.us-central1.run.app/health
  ```

- [ ] Servers endpoint returns data:
  ```bash
  curl https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers
  ```

- [ ] CORS headers present:
  ```bash
  curl -H "Origin: https://mcp-registry-sentilabs.vercel.app" \
    -I https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers
  ```

### Frontend Tests

- [ ] Visit https://mcp-registry-sentilabs.vercel.app/registry
- [ ] Open DevTools → Network tab
- [ ] Verify API calls go to Cloud Run URL (not localhost)
- [ ] Verify servers load successfully
- [ ] Try search functionality
- [ ] Test one-click install feature

---

## Troubleshooting

### "Cannot connect to backend"
- Check Cloud Run service is running
- Verify CORS_ORIGIN includes Vercel domain
- Check browser console for CORS errors

### "No servers showing"
- Run `npm run seed` in backend
- Check database connection (can you connect via psql?)
- Check Cloud Run logs: `gcloud logging read --limit 50`

### "504 Gateway Timeout"
- Increase Cloud Run timeout: `--timeout 300`
- Check database query performance
- Verify Cloud SQL connection (if using Cloud SQL)

---

## Rollback

If deployment fails:

```bash
# Rollback Cloud Run
gcloud run services update-traffic mcp-registry-backend \
  --region us-central1 \
  --to-revisions PREVIOUS_REVISION=100

# Rollback Vercel env var
# Remove NEXT_PUBLIC_API_URL or set to previous value
```

---

## Success Criteria

✅ Backend health endpoint responds with 200
✅ Frontend loads servers from Cloud Run
✅ No CORS errors in browser console
✅ Search and filter work correctly
✅ At least 20 MCP servers visible in registry
