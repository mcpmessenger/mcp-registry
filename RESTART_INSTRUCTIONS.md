# RESTART BACKEND SERVER

The debug endpoint route has been added. **You MUST restart the backend server** for the changes to take effect.

## Steps:

1. **Stop the server** - Press `Ctrl+C` in the terminal where the backend is running

2. **Restart it:**
   ```bash
   cd backend
   npm start
   ```

3. **Wait for server to start** - You should see:
   ```
   🚀 Server running on port 3001
   ```

4. **Test the endpoint:**
   ```bash
   curl http://localhost:3001/v0.1/debug/server/com.google/maps-mcp
   ```

## The route is now at:
`GET /v0.1/debug/server/:serverId`

It's added directly to the servers router, so it should work once the server restarts.

