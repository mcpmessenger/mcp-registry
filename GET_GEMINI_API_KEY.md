# How to Get a New Gemini API Key

## 🔑 Quick Links

### Option 1: Google AI Studio (Recommended - Easiest)
**Direct Link**: https://aistudio.google.com/apikey

Steps:
1. Click the link above
2. Sign in with your Google account
3. Click "Create API Key"
4. Select or create a Google Cloud project
5. Copy your new API key

### Option 2: Google Cloud Console
**Direct Link**: https://console.cloud.google.com/apis/credentials

Steps:
1. Click the link above
2. Sign in with your Google account
3. Select or create a project
4. Click "Create Credentials" → "API Key"
5. Copy your new API key

### Option 3: Enable Gemini API First
If you need to enable the API first:
**Direct Link**: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com

Steps:
1. Click the link above
2. Select your project
3. Click "Enable"
4. Then go to https://aistudio.google.com/apikey to create the key

## 📝 After Getting Your Key

1. **Update in MCP Registry**:
   - Go to your registry
   - Edit the "Nano Banana MCP" server
   - Update the `GEMINI_API_KEY` in the Environment Variables field
   - Save

2. **Or Update via API**:
   ```powershell
   $body = @{
       serverId = "com.mcp-registry/nano-banana-mcp"
       env = @{
           GEMINI_API_KEY = "YOUR_NEW_API_KEY_HERE"
       }
   } | ConvertTo-Json

   Invoke-RestMethod -Uri "https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers/com.mcp-registry%2Fnano-banana-mcp" `
       -Method PUT `
       -ContentType "application/json" `
       -Body $body
   ```

## ⚠️ Important Notes

- **Free Tier Limits**: Free tier has very limited quotas for image generation
- **Rate Limits**: Check your quota at https://ai.dev/usage?tab=rate-limit
- **Billing**: Image generation may require a paid plan for higher quotas
- **Security**: Never commit API keys to git or share them publicly

## 🔍 Check Your Quota

After getting a new key, check your quota:
- **Usage Dashboard**: https://ai.dev/usage?tab=rate-limit
- **Rate Limits Info**: https://ai.google.dev/gemini-api/docs/rate-limits

## 🎯 Recommended: Google AI Studio

**Best option**: https://aistudio.google.com/apikey
- Fastest way to get a key
- No need to navigate Cloud Console
- Direct access to Gemini API

