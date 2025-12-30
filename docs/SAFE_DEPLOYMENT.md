# Safe Deployment Guide - No Local Setup Breaking

## ✅ Your Local Setup is Protected

The deploy script now **automatically skips** local database URLs, so you can deploy without changing your local `.env` file!

## What Gets Skipped Automatically

The deploy script will skip `DATABASE_URL` if it contains:
- `file:` (SQLite)
- `localhost`
- `127.0.0.1`
- `:54322` (local Supabase port)

**Your local `.env` file stays untouched!** 🎉

## Deployment Steps

### 1. Update Production Settings (Optional)

You can temporarily update these in `backend/.env` for production, or set them in Cloud Run console:

```env
# These are safe to change - won't affect local dev
PORT=8080
NODE_ENV=production
CORS_ORIGIN="https://your-app.vercel.app"
ENABLE_KAFKA=false  # Unless you have Kafka in production
```

**Note:** The deploy script will skip `DATABASE_URL` automatically if it's localhost.

### 2. Set Production Database URL

You have two options:

#### Option A: Set in Cloud Run Console (Recommended)
1. Deploy without `DATABASE_URL` (script skips it automatically)
2. Go to Cloud Run Console → Your Service → Edit & Deploy New Revision
3. Add environment variable:
   - **Key:** `DATABASE_URL`
   - **Value:** Your Cloud SQL connection string
   - Format: `postgresql://user:password@/dbname?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME`

#### Option B: Use Secret Manager (Most Secure)
1. Create secret in Secret Manager:
   ```powershell
   echo -n "postgresql://user:pass@/db?host=/cloudsql/..." | gcloud secrets create database-url --data-file=-
   ```
2. Grant Cloud Run access:
   ```powershell
   gcloud secrets add-iam-policy-binding database-url --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
   ```
3. Update deploy script to use: `DATABASE_URL=database-url:latest`

### 3. Deploy

```powershell
cd backend
.\deploy.ps1
```

The script will:
- ✅ Skip your local `DATABASE_URL` automatically
- ✅ Deploy all other environment variables
- ✅ Build and push Docker image
- ✅ Deploy to Cloud Run

### 4. Verify

```powershell
# Check health
curl https://your-backend-url.run.app/health

# Check logs
gcloud run services logs read mcp-registry-backend --region us-central1
```

## What About Your Local Development?

**Nothing changes!** Your local `.env` file with `localhost:54322` stays exactly as it is. The deploy script only reads it - it doesn't modify it.

## Troubleshooting

### Backend won't start in production
- Check Cloud Run logs for database connection errors
- Verify `DATABASE_URL` is set in Cloud Run console (not in `.env` file)
- Ensure Cloud SQL instance is running and accessible

### Local development broken after deployment
- This shouldn't happen! The deploy script doesn't modify your local `.env`
- If it does, check that your local `.env` still has `localhost:54322`
- Restart your local backend: `cd backend && npm start`

## Quick Reference

| Setting | Local Dev | Production |
|---------|-----------|------------|
| `DATABASE_URL` | `localhost:54322` (auto-skipped) | Cloud SQL (set in console) |
| `PORT` | `3001` | `8080` |
| `NODE_ENV` | `development` | `production` |
| `CORS_ORIGIN` | `http://localhost:3000` | Your Vercel URL |
| `ENABLE_KAFKA` | `true` | `false` (unless you have Kafka) |

## Next Steps

1. ✅ Deploy backend (local `.env` stays safe)
2. ✅ Set `DATABASE_URL` in Cloud Run console
3. ✅ Deploy frontend to Vercel
4. ✅ Update `CORS_ORIGIN` in Cloud Run
5. ✅ Test everything!

---

**Remember:** Your local setup is protected. The deploy script is smart enough to skip local database URLs automatically! 🛡️
