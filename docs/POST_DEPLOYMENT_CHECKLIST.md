# Post-Deployment Checklist

This checklist covers the steps required after deploying the MCP Registry backend to ensure everything is working correctly.

## ✅ Completed Steps

### 1. Cloud SQL Proxy Setup
- [x] Start Cloud SQL Proxy in a separate terminal:
  ```powershell
  cd C:\Users\senti\OneDrive\Desktop\mcp-registry
  .\cloud-sql-proxy.exe --instances=slashmcp:us-central1:mcp-registry-db=tcp:5432
  ```
- [x] Verify proxy shows "Ready for new connections"

### 2. Database Credentials Synchronization
- [x] Verify Cloud SQL user password matches secret:
  ```powershell
  gcloud sql users set-password postgres --instance=mcp-registry-db --password=<password>
  ```
- [x] Update `db-password` secret (UTF-8, no BOM):
  ```powershell
  $pw = '<password>'
  $tmp = Join-Path $env:TEMP 'db-password.txt'
  [System.IO.File]::WriteAllText($tmp, $pw, (New-Object System.Text.UTF8Encoding $false))
  gcloud secrets versions add db-password --data-file=$tmp
  Remove-Item $tmp
  ```
- [x] Update `db-url` secret (UTF-8, no BOM):
  ```powershell
  $url = 'postgresql://postgres:<password>@localhost/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db'
  $tmp = Join-Path $env:TEMP 'db-url.txt'
  [System.IO.File]::WriteAllText($tmp, $url, (New-Object System.Text.UTF8Encoding $false))
  gcloud secrets versions add db-url --data-file=$tmp
  Remove-Item $tmp
  ```

### 3. Database Migrations
- [x] Resolve migration conflicts (if enum already exists):
  ```powershell
  cd backend
  $env:DATABASE_URL = "postgresql://postgres:<password>@localhost:5432/mcp_registry"
  npx prisma migrate resolve --applied <migration_name> --schema=./prisma/schema.prisma
  ```
- [x] Run migrations:
  ```powershell
  scripts\run-migrations-local.ps1
  ```
- [x] Verify "No pending migrations to apply" message

## 🔄 Next Steps

### 4. Backend Health Verification
- [ ] Check backend health endpoint:
  ```powershell
  Invoke-WebRequest -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/health" -UseBasicParsing
  ```
- [ ] Verify response contains `{"status": "ok", ...}`

### 5. Backend API Verification
- [ ] Test MCP servers list endpoint:
  ```powershell
  Invoke-WebRequest -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers" -UseBasicParsing
  ```
- [ ] Verify JSON response is returned successfully

### 6. Frontend Configuration
- [ ] Verify Vercel environment variable `NEXT_PUBLIC_API_URL` is set to:
  ```
  https://mcp-registry-backend-554655392699.us-central1.run.app
  ```
- [ ] Trigger Vercel redeploy (push to main or use Vercel dashboard)
- [ ] Verify frontend loads without "Cannot connect to backend" errors
- [ ] Check browser console for: `[API Client] Using backend URL: https://mcp-registry-backend-554655392699.us-central1.run.app`

### 7. Playwright Endpoint Testing (if applicable)
- [ ] Test Playwright tool invocation from UI or API client
- [ ] Verify browser operations complete without timeout errors
- [ ] Check Cloud Run logs for browser launch errors:
  ```powershell
  gcloud run services logs read mcp-registry-backend --region us-central1 --limit 50
  ```

### 8. Cloud Run Service Verification
- [ ] Verify service configuration:
  ```powershell
  gcloud run services describe mcp-registry-backend --region us-central1 --format="json"
  ```
- [ ] Check that memory is set to 2Gi (required for Chromium)
- [ ] Verify `DATABASE_URL` secret is correctly referenced
- [ ] Verify `CORS_ORIGIN` includes your Vercel domain

## 🐛 Troubleshooting

### Migration Conflicts
If you see `ERROR: type "JobStatus" already exists`:
1. Mark migration as applied (if enum already exists):
   ```powershell
   cd backend
   $env:DATABASE_URL = "postgresql://postgres:<password>@localhost:5432/mcp_registry"
   npx prisma migrate resolve --applied <migration_name> --schema=./prisma/schema.prisma
   ```

### Authentication Failures
- Verify Cloud SQL Proxy is running and shows "Ready for new connections"
- Check that password in secret matches Cloud SQL user password
- Ensure `gcloud` is authenticated with correct account:
  ```powershell
  gcloud config set account <your-email>
  gcloud config set project slashmcp
  ```

### Port Already in Use
If port 5432 is already in use:
1. Find the process:
   ```powershell
   netstat -ano | Select-String ":5432"
   ```
2. Stop the conflicting process (if safe):
   ```powershell
   Stop-Process -Id <pid> -Force
   ```
3. Or use a different port for the proxy:
   ```powershell
   .\cloud-sql-proxy.exe --instances=slashmcp:us-central1:mcp-registry-db=tcp:5433
   ```

### Secret Encoding Issues
When updating secrets, always use UTF-8 without BOM:
```powershell
[System.IO.File]::WriteAllText($tmp, $value, (New-Object System.Text.UTF8Encoding $false))
```

## 📝 Notes

- **Cloud SQL Proxy**: Must remain running in a separate terminal while running migrations
- **Password Sync**: Always ensure Cloud SQL user password, `db-password` secret, and `db-url` secret all match
- **Migration Strategy**: If database objects already exist, use `migrate resolve --applied` instead of dropping them
- **Account Switching**: Use `gcloud config set account` to switch between accounts if needed

## 🔗 Related Documentation

- [Deployment Guide](./DEPLOYMENT.md)
- [Deployment Test Plan](./DEPLOYMENT_TEST_PLAN.md)
- [Architecture Documentation](./ARCHITECTURE.md)

---

*Last Updated: December 22, 2025*















