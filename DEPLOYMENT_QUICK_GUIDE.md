# Quick Deployment Guide

## Summary

- **Frontend (Vercel)**: Only needs **1 variable** → `NEXT_PUBLIC_API_URL`
- **Backend (Cloud Run)**: Uses your existing `.env` file, but check these changes

---

## Frontend Deployment (Vercel)

### 1. Deploy to Vercel

```powershell
# From project root
vercel --prod
```

### 2. Set the ONE Environment Variable

In Vercel Dashboard → Settings → Environment Variables:

- **Key:** `NEXT_PUBLIC_API_URL`
- **Value:** `https://mcp-registry-backend-554655392699.us-central1.run.app`
- **Environment:** Production (and Preview if desired)

That's it! Frontend is done.

---

## Backend Deployment (Cloud Run)

### Current `.env` Status

Your backend `.env` already has production settings. Verify these before deploying:

1. ✅ **PORT=8080** (Cloud Run standard)
2. ✅ **NODE_ENV=production**
3. ✅ **DATABASE_URL** - Should use Cloud SQL socket format:
   ```
   DATABASE_URL="postgresql://postgres:Aardvark41%2B@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db"
   ```
4. ✅ **CORS_ORIGIN** - Should include your Vercel URL:
   ```
   CORS_ORIGIN="https://your-vercel-app.vercel.app,https://slashmcp.com,https://main.d2cddqmnkv63mg.amplifyapp.com,https://mcp-registry-sentilabs.vercel.app"
   ```
5. ⚠️ **ENABLE_KAFKA** - Set to `false` unless you have Kafka infrastructure in production

### Deploy Backend

```powershell
cd backend
.\deploy.ps1
```

The script will:
- Build Docker image
- Push to Artifact Registry
- Deploy to Cloud Run
- Use environment variables from your `.env` file

---

## Deployment Order

1. **Deploy Backend first** → Get the Cloud Run URL
2. **Deploy Frontend** → Set `NEXT_PUBLIC_API_URL` to backend URL
3. **Update Backend CORS** → Add your Vercel URL to `CORS_ORIGIN` and redeploy

---

## Important Notes

- **Kafka**: Disable in production (`ENABLE_KAFKA=false`) unless you have Kafka infrastructure
- **Database**: Your `.env` should already have the Cloud SQL connection string
- **CORS**: After deploying frontend, update backend `CORS_ORIGIN` to include your Vercel URL
- **API Keys**: Make sure all API keys are set in your `.env` file

---

## Quick Checklist

- [ ] Backend `.env` has `PORT=8080`
- [ ] Backend `.env` has `NODE_ENV=production`
- [ ] Backend `.env` has Cloud SQL `DATABASE_URL`
- [ ] Backend `.env` has `CORS_ORIGIN` with production URLs
- [ ] Backend `.env` has `ENABLE_KAFKA=false` (unless you have Kafka)
- [ ] Deploy backend → Get Cloud Run URL
- [ ] Deploy frontend → Set `NEXT_PUBLIC_API_URL`
- [ ] Update backend `CORS_ORIGIN` with Vercel URL → Redeploy backend

