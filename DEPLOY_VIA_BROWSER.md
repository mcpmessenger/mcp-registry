# Deploy Backend via Google Cloud Console (No CLI Required)

Since the `gcloud` CLI has permission issues on your Windows machine, you can deploy directly through the Google Cloud Console web interface.

## Step 1: Set Up Database (2 minutes)

### Using Supabase (Recommended - Free & Fast)

1. Go to [https://supabase.com](https://supabase.com)
2. Click **Start your project**
3. Sign in with GitHub
4. Click **New Project**
5. Fill in:
   - **Name**: `mcp-registry`
   - **Database Password**: (create a strong password - save it!)
   - **Region**: US West (or closest to you)
6. Click **Create new project** (takes ~2 minutes)
7. Once ready, go to **Settings** (gear icon) → **Database**
8. Scroll to **Connection string** → **URI**
9. Copy the connection string (looks like):
   ```
   postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres
   ```
10. Save this - you'll need it later ✅

---

## Step 2: Deploy Backend to Cloud Run

### Option A: Deploy from Source (Easiest)

1. **Open Cloud Console**
   - Go to: [https://console.cloud.google.com/run?project=554655392699](https://console.cloud.google.com/run?project=554655392699)

2. **Find or Create Service**
   - Look for `mcp-registry-backend` service
   - If it exists, click on it → **EDIT & DEPLOY NEW REVISION**
   - If not, click **CREATE SERVICE**

3. **Set up Container**
   - Select **Continuously deploy from a repository (source-based)**
   - Click **SET UP CLOUD BUILD**
   - If prompted, enable Cloud Build API
   - Click **Connect repository**
   
4. **Connect GitHub**
   - Click **Manage connected repositories**  
   - Click **Add repository**
   - Select: `mcpmessenger/mcp-registry`
   - Click **Connect**
   - Back on deploy page, select the repository
   - **Branch**: `main`
   - **Build Type**: Dockerfile
   - **Dockerfile location**: `/backend/Dockerfile` ⚠️ **IMPORTANT: Must include `/backend/` prefix**
   - **Build context directory**: Leave as `/` (root)
   - Click **SAVE**

5. **Configure Service Settings**
   
   **Container, Variables & Secrets, Connections, Security:**
   - Scroll to **Container(s), Volumes, Networking, Security**
   - Click **Variables & Secrets** tab
   - Add environment variables (click **+ ADD VARIABLE**):
   
   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | Your Supabase connection string |
   | `NODE_ENV` | `production` |
   | `PORT` | `8080` |
   | `CORS_ORIGIN` | `https://mcp-registry-sentilabs.vercel.app,https://slashmcp.com` |
   | `GOOGLE_GEMINI_API_KEY` | `AIzaSyCz9bk69IVoPCiznmlyeO8fHUVG9F05NTA` |
   | `GOOGLE_VISION_API_KEY` | `AIzaSyCz9bk69IVoPCiznmlyeO8fHUVG9F05NTA` |
   | `OPENAI_API_KEY` | Your OpenAI key from .env |
   | `ENABLE_KAFKA` | `false` |
   | `ENABLE_PULSAR` | `false` |

6. **Configure Resources**
   - **Memory**: `2 GiB`
   - **CPU**: `2`
   - **Request timeout**: `300` seconds
   - **Maximum instances**: `10`
   - **Minimum instances**: `0`

7. **Configure Security**
   - **Authentication**: ✅ **Allow unauthenticated invocations**

8. **Deploy**
   - Click **CREATE** (or **DEPLOY** if updating)
   - Wait for deployment (5-10 minutes for first deploy)
   - Once complete, you'll see a green checkmark ✅
   - Copy the **URL** (e.g., `https://mcp-registry-backend-554655392699.us-central1.run.app`)

---

## Step 3: Run Database Migrations

After backend is deployed, you need to run Prisma migrations.

### Using Local Terminal (Fastest)

```bash
# Set database URL temporarily
$env:DATABASE_URL="YOUR_SUPABASE_URL_HERE"

# Navigate to backend
cd c:\Users\senti\OneDrive\Desktop\mcp-registry\backend

# Install dependencies (if not done)
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed database with official MCP servers
npm run seed
```

### Alternative: Using Google Cloud Shell

1. Click the Cloud Shell icon (>_) in the top right of Cloud Console
2. Clone your repository:
   ```bash
   git clone https://github.com/mcpmessenger/mcp-registry.git
   cd mcp-registry/backend
   ```
3. Set database URL:
   ```bash
   export DATABASE_URL="YOUR_SUPABASE_URL_HERE"
   ```
4. Run migrations:
   ```bash
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npm run seed
   ```

---

## Step 4: Update Frontend (Vercel)

1. **Open Vercel Dashboard**
   - Go to: [https://vercel.com](https://vercel.com)
   - Select project: `mcp-registry-sentilabs`

2. **Add Environment Variable**
   - Go to **Settings** → **Environment Variables**
   - Click **Add New**
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://mcp-registry-backend-554655392699.us-central1.run.app`
   - **Environment**: ✅ Production, ✅ Preview
   - Click **Save**

3. **Redeploy**
   - Go to **Deployments** tab
   - Click **…** (three dots) on the latest deployment
   - Click **Redeploy**
   - Wait for deployment to complete (~2 minutes)

---

## Step 5: Verify Everything Works

### 1. Test Backend Health

Open in browser:
```
https://mcp-registry-backend-554655392699.us-central1.run.app/health
```

Should see:
```json
{"status":"ok","timestamp":"...","environment":"production"}
```

### 2. Test Servers Endpoint

Open in browser:
```
https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers
```

Should see JSON array of MCP servers.

### 3. Test Live Frontend

1. Go to: [https://mcp-registry-sentilabs.vercel.app/registry](https://mcp-registry-sentilabs.vercel.app/registry)
2. Open DevTools (F12) → Network tab
3. Verify servers are loading
4. Check that API calls go to Cloud Run URL (not localhost)

---

## Troubleshooting

### "Internal Server Error" on /health

**Check Cloud Run logs:**
1. Go to Cloud Run service page
2. Click **LOGS** tab
3. Look for errors (database connection issues, missing env vars)

**Common fixes:**
- Verify `DATABASE_URL` is correct and reachable
- Check all required env vars are set
- Ensure Prisma migrations ran successfully

### "No servers showing" on frontend

**Run database seed:**
```bash
cd backend
$env:DATABASE_URL="YOUR_SUPABASE_URL"
npm run seed
npm run register-top-20
```

### CORS errors in browser

**Update CORS_ORIGIN:**
1. Go to Cloud Run service
2. Edit & deploy new revision
3. Update `CORS_ORIGIN` to include your Vercel domain
4. Deploy

---

## Success! 🎉

You should now have:
- ✅ Backend deployed to Cloud Run
- ✅ Database running on Supabase
- ✅ Frontend connecting to production backend
- ✅ Live demo working at slashmcp.com

**Next Steps:**
1. Add more MCP servers to registry
2. Test one-click install feature
3. Enable orchestrator (optional, for advanced features)
4. Set up monitoring and alerts
