# Frontend Loading Issue - Debug Guide

## Current Status
- ✅ Backend is running on port 3001
- ✅ Backend `/v0/servers` endpoint returns 200 OK
- ✅ CORS is configured to allow localhost:3000
- ⚠️ Frontend on port 3000 is hanging/loading

## Debugging Steps

### 1. Check Browser Console
Open DevTools (F12) and check:
- **Console tab**: Look for errors or fetch failures
- **Network tab**: Check if request to `http://localhost:3001/v0/servers` is:
  - Pending (hanging)
  - Failed (CORS/network error)
  - Blocked
  - Status code

### 2. Verify Backend is Accessible
```powershell
# Test health endpoint
curl http://localhost:3001/health

# Test servers endpoint
curl http://localhost:3001/v0/servers
```

### 3. Check CORS Headers
In browser Network tab, check the response headers for:
- `Access-Control-Allow-Origin: http://localhost:3000`
- `Access-Control-Allow-Methods: GET, POST, ...`

### 4. Test Direct URL
Open `http://localhost:3001/v0/servers` directly in browser.
- Should return JSON
- If blocked, it's a CORS issue

### 5. Restart Frontend
```powershell
# Stop frontend (Ctrl+C)
# Then restart:
cd C:\Users\senti\OneDrive\Desktop\mcp-registry
npm run dev
```

### 6. Check for Port Conflicts
```powershell
netstat -ano | findstr :3000
netstat -ano | findstr :3001
```

## Recent Changes Made

1. **Reduced timeout** from 10s to 5s for faster failure detection
2. **Added cache: 'no-cache'** to prevent browser caching issues
3. **Improved error messages** with more specific network errors
4. **Enhanced loading UI** with troubleshooting tips

## Common Issues

### Issue: Request is "Pending" in Network Tab
**Cause**: Backend not responding or CORS preflight failing
**Solution**: 
- Check backend logs
- Verify CORS middleware is working
- Check firewall/antivirus

### Issue: CORS Error
**Cause**: Backend not allowing origin
**Solution**: 
- Verify `CORS_ORIGIN` in backend `.env`
- Check backend CORS middleware logs
- Ensure `NODE_ENV=development` (allows all origins)

### Issue: Network Error
**Cause**: Backend not running or wrong URL
**Solution**:
- Verify backend is running on port 3001
- Check `NEXT_PUBLIC_API_URL` in frontend (defaults to `http://localhost:3001`)
- Test backend directly with curl

### Issue: Timeout
**Cause**: Backend taking too long to respond
**Solution**:
- Check backend logs for errors
- Verify database connection
- Check for slow queries

## Quick Fixes

### Fix 1: Hard Refresh Browser
- Press `Ctrl+Shift+R` or `Ctrl+F5`
- Clears cache and forces reload

### Fix 2: Clear Browser Cache
- Open DevTools → Application → Clear Storage
- Or use Incognito/Private mode

### Fix 3: Restart Both Servers
```powershell
# Stop both (Ctrl+C in each terminal)
# Restart backend:
cd backend
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mcp_registry"
npm start

# Restart frontend (new terminal):
cd ..
npm run dev
```

### Fix 4: Check Environment Variables
Frontend should use:
- `NEXT_PUBLIC_API_URL=http://localhost:3001` (optional, defaults to this)

Backend should have:
- `CORS_ORIGIN=http://localhost:3000`
- `NODE_ENV=development`

## Expected Behavior

1. Frontend loads → Shows "Loading servers from backend..."
2. Fetch request to `http://localhost:3001/v0/servers`
3. Backend responds with JSON array
4. Frontend displays server cards
5. Loading state clears

If step 2-3 hangs, check Network tab for the exact issue.
