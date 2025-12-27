# Quick Fix for Debug Endpoint 404

The debug endpoint isn't working because **the backend server needs to be restarted** after the code changes.

## Steps to Fix:

1. **Stop the backend server** (Ctrl+C in the terminal where it's running)

2. **Restart the backend:**
   ```bash
   cd backend
   npm start
   ```

3. **Verify the route is registered** - You should see in the console:
   ```
   [Server] Registering debug router at /v0.1/debug
   ```

4. **Test the endpoint:**
   ```bash
   curl http://localhost:3001/v0.1/debug/server/com.google/maps-mcp
   ```

## Alternative: Add Route to Servers Router

If the separate router still doesn't work, we can add the debug route directly to the v0 servers router instead:

```typescript
// In backend/src/routes/v0/servers.ts
router.get('/debug/server/:serverId', async (req, res) => {
  // ... debug endpoint code
})
```

Then access it at: `/v0.1/debug/server/:serverId` (still the same path)

