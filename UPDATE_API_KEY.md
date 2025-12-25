# How to Update Gemini API Key for Nano Banana MCP

## 🎯 Quick Method: Via UI

1. **Go to your MCP Registry** (the registry page in your app)
2. **Find "Nano Banana MCP"** in the list
3. **Click "Edit"** (or the edit icon)
4. **Find the "Environment Variables" or "Credentials" field**
5. **Update the `GEMINI_API_KEY` value** with your new key
6. **Save**

## 🔧 Method 2: Via API (PowerShell)

Run this command in PowerShell:

```powershell
# Replace YOUR_NEW_API_KEY_HERE with your actual new API key
$newApiKey = "YOUR_NEW_API_KEY_HERE"

$body = @{
    env = @{
        GEMINI_API_KEY = $newApiKey
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers/com.mcp-registry%2Fnano-banana-mcp" `
    -Method PUT `
    -ContentType "application/json" `
    -Body $body
```

## ✅ Verify It Worked

After updating, verify the key is set:

```powershell
$response = Invoke-RestMethod -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers/com.mcp-registry%2Fnano-banana-mcp" -Method GET
$response.env
```

You should see your new `GEMINI_API_KEY` in the output.

## 🧪 Test It

After updating, try generating a design again in your chat interface!

