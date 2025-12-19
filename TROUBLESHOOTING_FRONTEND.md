# Frontend Hanging - Troubleshooting Guide

## Issue
Frontend on port 3000 hangs/loads indefinitely when trying to fetch from backend.

## Quick Checks

### 1. Verify Backend is Running
```powershell
curl http://localhost:3001/health
# Should return: {"status":"ok",...}
```

### 2. Verify Backend Endpoint Works
```powershell
curl http://localhost:3001/v0/servers
# Should return JSON array of servers
```

### 3. Check Browser Console
Open DevTools (F12) and check:
- **Console tab**: Look for errors or network failures
- **Network tab**: Check if the request to `/v0/servers` is:
  - Pending (hanging)
  - Failed (CORS/network error)
  - Blocked

### 4. Check CORS
The backend should allow `http://localhost:3000`. Check:
- Browser console for CORS errors
- Backend logs for CORS rejections

## Common Causes

### 1. Backend Not Running
**Solution**: Start backend server
```powershell
cd backend
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mcp_registry"
npm start
```

### 2. CORS Issue
**Symptoms**: Browser console shows CORS error
**Solution**: Backend CORS middleware should allow localhost:3000 (already configured)

### 3. Network/Firewall Blocking
**Symptoms**: Request shows as "blocked" or "failed" in Network tab
**Solution**: Check Windows Firewall or antivirus

### 4. Fetch Timeout
**Symptoms**: Request hangs for >10 seconds
**Solution**: Added 10-second timeout to fetch requests (already implemented)

### 5. JavaScript Error
**Symptoms**: Page doesn't render, console shows errors
**Solution**: Check browser console for errors

## Debug Steps

1. **Open Browser DevTools** (F12)
2. **Go to Network tab**
3. **Refresh the page**
4. **Look for request to `http://localhost:3001/v0/servers`**
5. **Check status**:
   - If "pending" → Backend not responding or network issue
   - If "failed" → Check error message
   - If "CORS error" → Backend CORS config issue
   - If "blocked" → Firewall/antivirus

## Test Backend Directly

```powershell
# Test health
Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing

# Test servers endpoint
Invoke-WebRequest -Uri "http://localhost:3001/v0/servers" -UseBasicParsing
```

## If Still Hanging

1. **Check backend logs** - Is the request reaching the backend?
2. **Check browser Network tab** - What's the exact status?
3. **Try direct URL** - Open `http://localhost:3001/v0/servers` in browser
4. **Check firewall** - Windows Firewall might be blocking Node.js

## Quick Fix

If the page is stuck loading, you can:
1. Open browser console (F12)
2. Check for errors
3. Try refreshing the page
4. Check if backend is actually running

The fetch now has a 10-second timeout, so it should fail gracefully if the backend isn't responding.
