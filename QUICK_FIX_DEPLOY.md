# 🚀 QUICK FIX - Deploy Backend Now

## The Problem
Cloud Build couldn't find the Dockerfile because it's in the `backend/` directory, not the root.

## The Solution
I've created `cloudbuild.yaml` which tells Cloud Build exactly where to find everything.

---

## ✅ Step 1: Push to GitHub (IN PROGRESS)
Your `cloudbuild.yaml` file is being pushed to GitHub now. Wait for it to complete.

---

## ✅ Step 2: Set Up Cloud Build Trigger (5 minutes)

### A. Create the Trigger

1. **Open Cloud Build Triggers**:
   - Go to: [https://console.cloud.google.com/cloud-build/triggers?project=554655392699](https://console.cloud.google.com/cloud-build/triggers?project=554655392699)

2. **Click CREATE TRIGGER**

3. **Configure Trigger**:
   - **Name**: `deploy-backend-auto`
   - **Description**: `Auto-deploy backend on push to main`
   - **Event**: ✅ **Push to a branch**
   - **Source**: 
     - **Repository**: Select `mcpmessenger/mcp-registry` (connect if needed)
     - **Branch**: `^main$`
   - **Configuration**:
     - **Type**: ☑️ **Cloud Build configuration file (yaml or json)**
     - **Location**: `/cloudbuild.yaml`
   - Click **CREATE**

### B. Run the Trigger Manually (First Time)

1. Find your new trigger in the list
2. Click **RUN** button
3. Click **RUN TRIGGER** in the popup
4. You'll be redirected to the [Build History page](https://console.cloud.google.com/cloud-build/builds?project=554655392699)
5. Watch the build progress (takes ~5-10 minutes)

---

## ✅ Step 3: Monitor the Build

The build will show 3 steps:
1. **Build Docker image** (~5 minutes)
2. **Push to Artifact Registry** (~1 minute)
3. **Deploy to Cloud Run** (~2 minutes)

**Wait for all 3 steps to complete with green checkmarks** ✅

---

## ✅ Step 4: Add Environment Variables

After build succeeds, add environment variables to Cloud Run:

1. **Go to Cloud Run**:
   - [https://console.cloud.google.com/run/detail/us-central1/mcp-registry-backend?project=554655392699](https://console.cloud.google.com/run/detail/us-central1/mcp-registry-backend?project=554655392699)

2. **Click EDIT & DEPLOY NEW REVISION**

3. **Go to "Variables & Secrets" tab**

4. **Add these variables** (click + ADD VARIABLE for each):

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | `postgresql://postgres.akxdroedpsvmckvqvggr:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres` |
   | `NODE_ENV` | `production` |
   | `CORS_ORIGIN` | `https://mcp-registry-sentilabs.vercel.app,https://slashmcp.com` |
   | `GOOGLE_GEMINI_API_KEY` | `AIzaSyCz9bk69IVoPCiznmlyeO8fHUVG9F05NTA` |
   | `GOOGLE_VISION_API_KEY` | `AIzaSyCz9bk69IVoPCiznmlyeO8fHUVG9F05NTA` |
   | `OPENAI_API_KEY` | Your OpenAI key |
   | `ENABLE_KAFKA` | `false` |
   | `ENABLE_PULSAR` | `false` |

5. **Click DEPLOY**

---

## ✅ Step 5: Get Your Supabase Password

You mentioned `https://akxdroedpsvmckvqvggr.supabase.co` - this is your Supabase instance!

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/projects)
2. Click on your `mcp-registry` project
3. Go to **Settings** (gear icon) → **Database**
4. Find **Connection string** → **URI**
5. Copy the full string (it has your password in it)
6. Use this as `DATABASE_URL` in Step 4

---

## ✅ Step 6: Run Database Migrations

After Cloud Run deployment with env vars:

```bash
cd c:\Users\senti\OneDrive\Desktop\mcp-registry\backend

# Set your Supabase connection string temporarily
$env:DATABASE_URL="postgresql://postgres.xxx:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres"

# Run migrations
npx prisma generate
npx prisma migrate deploy

# Seed with official MCP servers
npm run seed
npm run register-top-20
```

---

## ✅ Step 7: Verify It Works

### Test Backend
```bash
# Health check
curl https://mcp-registry-backend-554655392699.us-central1.run.app/health

# List servers
curl https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers
```

### Test Frontend
1. Go to: [https://mcp-registry-sentilabs.vercel.app/registry](https://mcp-registry-sentilabs.vercel.app/registry)
2. You should see 20+ MCP servers!

---

## 🎉 Success Criteria

- ✅ Cloud Build completes without errors
- ✅ Cloud Run service is running
- ✅ `/health` endpoint returns 200 OK
- ✅ `/v0.1/servers` returns JSON array
- ✅ Frontend loads servers from backend
- ✅ No "localhost:3001" errors

---

## ⚠️ Troubleshooting

### Build fails at Step 1 (Docker build)
- Check that `backend/Dockerfile` exists in your repository
- Verify `cloudbuild.yaml` is in the root directory

### Build fails at Step 3 (Deploy)
- Check Cloud Build service account has Cloud Run Admin role
- Verify project ID is correct (554655392699)

### Health check fails after deployment
- Add environment variables (especially DATABASE_URL)
- Check Cloud Run logs for errors

---

## 📞 Need Help?

If you get stuck at any step, let me know which step number and I'll help debug!

**Current status: Waiting for Step 2 (Cloud Build Trigger setup)**
