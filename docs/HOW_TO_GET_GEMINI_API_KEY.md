# How to Get a Gemini API Key

## Quick Steps

### Option 1: Google AI Studio (Recommended - Easiest)

1. **Go to Google AI Studio**
   - Visit: https://aistudio.google.com/apikey
   - Or: https://makersuite.google.com/app/apikey

2. **Sign in**
   - Use your Google account
   - If you don't have one, create a free account

3. **Create API Key**
   - Click **"Create API Key"** or **"Get API Key"**
   - Select a Google Cloud project (or create a new one)
   - The key will be generated immediately

4. **Copy the Key**
   - The key will look like: `AIzaSyCQeNta_oe4A-xlURzdEYZlx31-XsPIsAA`
   - **Important**: It always starts with `AIza...`
   - Copy the entire key (it's long, ~39 characters)

5. **Save it Securely**
   - ⚠️ **Never share this key publicly**
   - ⚠️ **Never commit it to GitHub**
   - Store it in a password manager or secure note

### Option 2: Google Cloud Console

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Enable Gemini API**
   - Go to **APIs & Services** > **Library**
   - Search for "Generative Language API"
   - Click **Enable**

3. **Create API Key**
   - Go to **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **API Key**
   - Copy the generated key

4. **Restrict the Key (Optional but Recommended)**
   - Click **Restrict Key**
   - Under **API restrictions**, select **Restrict key**
   - Choose **Generative Language API**
   - Click **Save**

## Key Format

✅ **Valid Gemini API Key:**
- Starts with: `AIza...`
- Length: ~39 characters
- Example: `AIzaSyCQeNta_oe4A-xlURzdEYZlx31-XsPIsAA`

❌ **NOT a Gemini API Key:**
- `AQ.xxx` - This is an OAuth token or different service
- `sk-xxx` - This is an OpenAI key
- `gcp_xxx` - This is a Google Cloud Platform token

## Free Tier Limits

The Gemini API has a **free tier** with limited quotas:

- **Text Generation**: Usually 15 requests per minute
- **Image Generation**: **0 requests** on free tier for `gemini-2.5-flash-preview-image`
- **Token Limits**: Varies by model

**To use image generation**, you may need to:
1. Wait for quota reset (daily)
2. Upgrade to a paid plan
3. Use a different model that has free tier support

## Check Your Quota

1. Visit: https://ai.dev/usage?tab=rate-limit
2. Sign in with the same Google account
3. View your current usage and limits

## Update the Key in SlashMCP.com

### Via UI:
1. Go to SlashMCP.com
2. Find "Nano Banana MCP" in the registry
3. Click **Edit**
4. In the **Credentials** field, paste your `AIza...` key
5. Click **Save**

### Via API (PowerShell):
```powershell
$serverId = "com.mcp-registry/nano-banana-mcp"
$newApiKey = "AIzaSyCQeNta_oe4A-xlURzdEYZlx31-XsPIsAA"  # Replace with your key
$backendUrl = "https://mcp-registry-backend-554655392699.us-central1.run.app"

$body = @{
    env = @{
        GEMINI_API_KEY = $newApiKey
        API_KEY = $newApiKey
    }
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "${backendUrl}/v0.1/servers/${serverId}" `
    -Method PATCH `
    -ContentType "application/json" `
    -Body $body
```

## Test Your Key

After getting your key, test it:

```powershell
cd backend
$env:GEMINI_API_KEY = "YOUR_AIza..._KEY_HERE"
node test-api-key.js
```

Or pass it as an argument:
```powershell
node backend\test-api-key.js YOUR_AIza..._KEY_HERE
```

## Troubleshooting

### "Invalid API key"
- Make sure the key starts with `AIza...`
- Check for typos or extra spaces
- Ensure you copied the entire key

### "Quota exceeded"
- Check your quota: https://ai.dev/usage?tab=rate-limit
- Free tier has very limited quotas
- Wait for daily reset or upgrade to paid plan

### "API keys are not supported"
- You're using an OAuth token (`AQ.xxx`) instead of an API key
- Get a proper API key from Google AI Studio

## Need Help?

- **Google AI Studio**: https://aistudio.google.com/
- **Gemini API Docs**: https://ai.google.dev/docs
- **Quota Info**: https://ai.dev/usage?tab=rate-limit
- **Support**: https://support.google.com/aistudio

