# Google API Keys Setup Guide

## Required API Keys

You need **2 Google API keys** for the MCP server to work:

### 1. **GOOGLE_GEMINI_API_KEY** (Required)
- **Purpose**: Generate SVG graphics from text descriptions
- **Used for**: `generate_svg` and `refine_design` tools
- **API**: Google Gemini API (Generative AI)
- **Model**: Uses `gemini-pro` (compatible with v1beta API)

### 2. **GOOGLE_VISION_API_KEY** (Optional but Recommended)
- **Purpose**: Analyze images (labels, text, colors, logos)
- **Used for**: Image analysis features
- **API**: Google Cloud Vision API
- **Alternative**: Can use `GOOGLE_APPLICATION_CREDENTIALS` with service account JSON file

## Environment Variable Names

Add these to your `.env` file in the `backend/` directory:

```env
GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_VISION_API_KEY=your_vision_api_key_here
```

## How to Get API Keys

### Step 1: Create/Select Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project name

### Step 2: Enable Required APIs

Enable these APIs in your project:

#### For Gemini API:
1. Go to [API Library](https://console.cloud.google.com/apis/library)
2. Search for "**Generative Language API**" or "**Gemini API**"
3. Click "Enable"

#### For Vision API (Optional):
1. In API Library, search for "**Cloud Vision API**"
2. Click "Enable"

### Step 3: Create API Keys

#### Option A: Create API Keys (Easiest)

1. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "**Create Credentials**" → "**API Key**"
3. Copy the generated API key
4. (Recommended) Click "**Restrict Key**" to:
   - Restrict to specific APIs (Generative Language API, Cloud Vision API)
   - Restrict to your IP address (for production)

#### Option B: Use Service Account (More Secure)

For Vision API, you can use a service account instead:

1. Go to [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Create a new service account
3. Download the JSON key file
4. Set in `.env`:
   ```env
   GOOGLE_APPLICATION_CREDENTIALS=C:/path/to/service-account-key.json
   ```

### Step 4: Add Keys to .env

Update your `backend/.env` file:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mcp_registry"
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Google API Keys
GOOGLE_GEMINI_API_KEY=AIzaSy...your_key_here
GOOGLE_VISION_API_KEY=AIzaSy...your_key_here
```

## Verification

After adding keys, restart your server:

```powershell
# Stop the server (Ctrl+C)
# Then restart:
cd backend
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mcp_registry"
npm start
```

Test SVG generation:

```powershell
$body = @{
    description = "minimalist icon, blue palette"
    style = "modern"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3001/api/mcp/tools/generate" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

## Important Notes

### Billing
- Google Cloud offers **free tier** with limited requests
- Gemini API: Free tier includes generous quotas
- Vision API: First 1,000 requests/month are free
- Monitor usage in [Google Cloud Console](https://console.cloud.google.com/billing)

### Security Best Practices
1. **Never commit API keys to Git** - `.env` should be in `.gitignore`
2. **Restrict API keys** - Limit to specific APIs and IPs
3. **Use service accounts** for production (more secure than API keys)
4. **Rotate keys regularly** - Change keys if compromised

### API Quotas
- Check quotas in [API Dashboard](https://console.cloud.google.com/apis/dashboard)
- Set up alerts for quota limits
- Consider upgrading if you hit limits

## Troubleshooting

### "API key not valid" error
- Verify the key is correct (no extra spaces)
- Check that APIs are enabled in your project
- Ensure the key has access to the required APIs

### "Quota exceeded" error
- Check your usage in Google Cloud Console
- Wait for quota reset or upgrade your plan
- Consider implementing rate limiting

### "Permission denied" error
- Verify API is enabled for your project
- Check API key restrictions
- Ensure billing is enabled (required for some APIs)

## Quick Reference

| Environment Variable | Required | Purpose | API |
|---------------------|----------|---------|-----|
| `GOOGLE_GEMINI_API_KEY` | ✅ Yes | SVG generation | Gemini API |
| `GOOGLE_VISION_API_KEY` | ⚠️ Optional | Image analysis | Vision API |
| `GOOGLE_APPLICATION_CREDENTIALS` | ⚠️ Alternative | Service account | Vision API |

## Links

- [Google Cloud Console](https://console.cloud.google.com/)
- [API Library](https://console.cloud.google.com/apis/library)
- [Credentials](https://console.cloud.google.com/apis/credentials)
- [Gemini API Docs](https://ai.google.dev/docs)
- [Vision API Docs](https://cloud.google.com/vision/docs)
