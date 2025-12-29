# Add Your IP to Cloud SQL Authorized Networks

## Your IP Address
`147.92.98.214`

## Steps to Add to Authorized Networks

1. **Go to Cloud SQL Connections page**:
   https://console.cloud.google.com/sql/instances/mcp-registry-db/edit?project=554655392699
   
   Or:
   - Go to Cloud SQL Console
   - Click on `mcp-registry-db` instance
   - Click "Edit" (or go to "Connections" tab)

2. **Scroll to "Authorized networks"** section

3. **Click "Add a network"** button

4. **Enter your IP**:
   - **Name**: `My Local IP` (or any name you want)
   - **Network**: `147.92.98.214/32`
     - The `/32` means just this single IP address
   
5. **Click "Done"**

6. **Click "Save"** at the bottom

7. **Wait a minute** for the change to apply

## Then Run Migrations

After saving, try migrations again:

```powershell
cd backend
npx prisma migrate deploy
```

## Notes

- `/32` means only this specific IP address is allowed
- You can remove this later for security
- Cloud Run doesn't need this - it uses the Unix socket connection

