# Database Setup Options for Production

## Option 1: Supabase (Recommended for Quick Start) - **FREE**

### Steps:
1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project (takes ~2 minutes to provision)
3. Go to **Settings** → **Database**
4. Copy the **Connection String** (URI format)
5. Replace `[YOUR-PASSWORD]` with your database password
6. Update backend `.env`:
   ```env
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres"
   ```

### Advantages:
- ✅ Free tier (500MB database, 2GB bandwidth/month)
- ✅ No credit card required
- ✅ 2-minute setup
- ✅ Built-in auth, storage, and realtime features
- ✅ Great for MVP and early stage

---

## Option 2: Railway PostgreSQL - **FREE** 

### Steps:
1. Go to [https://railway.app](https://railway.app)
2. Sign in with GitHub
3. **New Project** → **Provision PostgreSQL**
4. Go to Variables tab
5. Copy `DATABASE_URL`
6. Update backend `.env`:
   ```env  
   DATABASE_URL="postgresql://postgres:password@containers-us-west-xx.railway.app:5432/railway"
   ```

### Advantages:
- ✅ $5 free credit per month
- ✅ Auto-scaling
- ✅ Simple UI
- ✅ Great DX

---

## Option 3: Google Cloud SQL - **~$7/month**

### Steps:
1. Enable Cloud SQL API in Google Cloud Console
2. Create PostgreSQL instance:
   ```bash
   gcloud sql instances create mcp-registry-db \
     --database-version=POSTGRES_15 \
     --tier=db-f1-micro \
     --region=us-central1
   ```
3. Create database:
   ```bash
   gcloud sql databases create mcp_registry \
     --instance=mcp-registry-db
   ```
4. Set password:
   ```bash
   gcloud sql users set-password postgres \
     --instance=mcp-registry-db \
     --password=YOUR_SECURE_PASSWORD
   ```
5. Get connection name:
   ```bash
   gcloud sql instances describe mcp-registry-db --format="value(connectionName)"
   ```
6. For Cloud Run, use Unix socket connection:
   ```env
   DATABASE_URL="postgresql://postgres:PASSWORD@/mcp_registry?host=/cloudsql/PROJECT:REGION:INSTANCE"
   ```
7. Add Cloud SQL connection in Cloud Run deployment:
   ```bash
   gcloud run services update mcp-registry-backend \
     --add-cloudsql-instances PROJECT:REGION:INSTANCE
   ```

### Advantages:
- ✅ Integrated with Google Cloud
- ✅ Automatic backups
- ✅ High availability options
- ✅ Best for production at scale

---

## After Database Setup

### 1. Update backend/.env
```bash
cd backend
# Edit .env and add DATABASE_URL
```

### 2. Run Prisma migrations
```bash
# Install dependencies if not done
npm install

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

### 3. Seed the database (optional, adds official MCP servers)
```bash
npm run seed
npm run register-top-20
```

---

## Quick Recommendation

**For this deployment, I recommend Supabase**:
- ✅ Fastest setup (2 minutes)
- ✅ Free tier
- ✅ No credit card required
- ✅ Perfect for getting live demo working ASAP

You can always migrate to Cloud SQL later if needed.
