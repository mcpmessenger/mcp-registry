# Quick Setup: Cloud SQL via Console (No CLI Needed)

## Using Google Cloud Console (Easiest)

Since gcloud CLI has permission issues, use the web console instead:

### 1. Create Instance

Go to: https://console.cloud.google.com/sql/instances/create?project=554655392699

**Settings**:
- **Instance ID**: `mcp-registry-db`
- **Database version**: PostgreSQL 15
- **Region**: `us-central1`
- **Machine type**: `db-f1-micro` (cheapest)
- **Root password**: `Aardvark41+` (or your password)
- Click **Create**

⏱️ Wait 5-10 minutes for instance to be created

### 2. Create Database

1. Click on instance `mcp-registry-db`
2. Go to **Databases** tab
3. Click **Create Database**
4. Name: `mcp_registry`
5. Click **Create**

### 3. Get Connection Name

In instance details, find **Connection name**:
- Example: `554655392699:us-central1:mcp-registry-db`
- Copy this!

### 4. Connect Cloud Run

1. Go to: https://console.cloud.google.com/run/detail/us-central1/mcp-registry-backend?project=554655392699
2. Click **Edit & Deploy New Revision**
3. Go to **Connections** tab
4. Under **Cloud SQL connections**, click **Add Connection**
5. Select: `mcp-registry-db`
6. Click **Deploy**

### 5. Update Backend Files

After instance is created, update these files:

**`backend/.env`**:
```env
DATABASE_URL="postgresql://postgres:Aardvark41+@/mcp_registry?host=/cloudsql/554655392699:us-central1:mcp-registry-db"
```

**`backend/prisma/schema.prisma`**:
```prisma
datasource db {
  provider = "postgresql"  // Change from "sqlite"
  url      = env("DATABASE_URL")
}
```

### 6. Generate & Migrate

```powershell
cd backend
npx prisma generate
npx prisma migrate deploy
```

### 7. Update Cloud Run Env Var

After connecting Cloud SQL, set the DATABASE_URL:

Go to Cloud Run → Edit → Variables & Secrets → Add:
- **Name**: `DATABASE_URL`
- **Value**: `postgresql://postgres:Aardvark41+@/mcp_registry?host=/cloudsql/554655392699:us-central1:mcp-registry-db`
- Click **Deploy**

## Done! ✅

Your backend will now connect to Cloud SQL!

