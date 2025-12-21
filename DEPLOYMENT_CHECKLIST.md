# Deployment Checklist - v0.1 API Migration

## ✅ Completed

- [x] Updated all backend routes from `/v0/` to `/v0.1/`
- [x] Added query parameter support (`?search=` and `?capability=`)
- [x] Updated frontend API client (`lib/api.ts`)
- [x] Enhanced CORS configuration with official guide references
- [x] Updated all documentation (README, backend README, CHANGELOG)
- [x] Created migration guide (`MIGRATION_V0.1.md`)
- [x] Created smoke test script (`smoke-test-v0.1.ps1`)
- [x] Committed all changes to git

## 🔄 Next Steps

### 1. Restart Backend Server

The backend server needs to be restarted to pick up the new route changes:

```bash
cd backend
# Stop the current server (Ctrl+C if running)
npm start
```

### 2. Run Smoke Test

After restarting the backend, verify everything works:

```powershell
powershell -ExecutionPolicy Bypass -File .\smoke-test-v0.1.ps1
```

Expected results:
- ✅ Health check passes
- ✅ `/v0.1/servers` returns server list
- ✅ Query parameters work correctly
- ✅ Old `/v0/` endpoints return 404

### 3. Push to GitHub

Push the committed changes to GitHub:

```bash
git push origin main
```

Or if you're on a feature branch:

```bash
git push origin <branch-name>
```

### 4. Update Production (if applicable)

If you have a production deployment:

1. **Pull changes** on production server
2. **Restart backend** service
3. **Verify endpoints** are working
4. **Monitor logs** for any errors

### 5. Notify Team/Users

If you have API consumers:
- Share the migration guide (`MIGRATION_V0.1.md`)
- Notify them of the breaking change
- Provide timeline for deprecation of old endpoints (if any)

## 📋 Verification Checklist

After deployment, verify:

- [ ] Backend server starts without errors
- [ ] Health endpoint responds: `GET /health`
- [ ] Server list endpoint works: `GET /v0.1/servers`
- [ ] Search query works: `GET /v0.1/servers?search=test`
- [ ] Capability filter works: `GET /v0.1/servers?capability=tools`
- [ ] Old endpoints return 404: `GET /v0/servers` → 404
- [ ] Frontend loads and displays servers correctly
- [ ] CORS headers are present in responses
- [ ] Smoke test passes all checks

## 🐛 Troubleshooting

### Backend returns 404 for `/v0.1/servers`

**Solution**: Make sure the backend server was restarted after the code changes. The routes are mounted in `backend/src/server.ts` and require a restart.

### Frontend can't connect to backend

**Solution**: 
1. Verify backend is running on port 3001
2. Check `NEXT_PUBLIC_API_URL` environment variable
3. Verify CORS is configured correctly

### Old endpoints still work

**Solution**: This means the backend wasn't restarted. Stop and restart the backend server.

## 📚 Documentation

- [Migration Guide](./MIGRATION_V0.1.md) - Detailed migration instructions
- [Official MCP Guide](./Official%20Model%20Context%20Protocol%20(MCP)%20Registry_%20Developer%20Guide.md) - Official specification
- [README](./README.md) - Updated API documentation
- [Backend README](./backend/README.md) - Backend-specific docs

## 🔗 Related Commits

- Commit: `db9b8c1` - feat: Migrate API from v0 to v0.1

---

**Status**: ✅ Ready for deployment (pending backend restart)
