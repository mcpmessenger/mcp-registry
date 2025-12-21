# Quick Start Guide

## To Fix the STDIO Server Issue

You need to **restart your backend server** to pick up the new STDIO support code.

### Step 1: Stop Current Backend (if running)

In your backend terminal, press `Ctrl+C` to stop the server.

### Step 2: Start Backend Server

```powershell
cd backend
npm start
```

You should see output like:
```
🚀 Server running on port 3001
📋 Registry API: http://localhost:3001/v0.1/servers
...
```

### Step 3: Restart Frontend (if needed)

In a **separate terminal**:

```powershell
# If frontend is running, stop it (Ctrl+C)
npm run dev
```

### Step 4: Test

1. Open `http://localhost:3000/chat`
2. Select "Google Maps MCP Server" from the agent dropdown
3. Try your query: "taco places des moines iowa"

It should work now! ✅

## What Changed

- **Backend**: Now supports STDIO-based servers (npx commands)
- **Frontend**: Skips endpoint validation for STDIO servers
- **Result**: Official servers (Playwright, Google Maps) work without endpoints

## Troubleshooting

### Backend won't start?

Check if port 3001 is already in use:
```powershell
netstat -ano | findstr :3001
```

### Still seeing endpoint errors?

1. Make sure backend is running (`http://localhost:3001/health`)
2. Hard refresh browser (Ctrl+Shift+R)
3. Check browser console for errors

### Need to see backend logs?

The backend terminal will show all requests and errors. Watch it while testing.

