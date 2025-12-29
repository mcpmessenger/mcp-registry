# Update .env with Public IP for Migrations

## Public IP Found! ✅
`34.56.74.73`

## Update backend/.env

Update line 5 in `backend/.env`:

**Change from (Unix socket format - for Cloud Run):**
```env
DATABASE_URL="postgresql://postgres:gLTiCaO4qxQIHchmk7Dt@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db"
```

**To (TCP format - for local migrations):**
```env
DATABASE_URL="postgresql://postgres:gLTiCaO4qxQIHchmk7Dt@34.56.74.73:5432/mcp_registry"
```

## Then Run Migrations

```powershell
cd backend
npx prisma migrate deploy
```

## Important Notes:

- **Local .env**: Use TCP format with public IP (for running migrations locally)
- **Cloud Run**: Already has Unix socket format set (keep that as-is in Cloud Run console)

After migrations succeed, your backend should work! 🚀

