# Google Maps API Key Setup Guide

**Issue**: Google Maps MCP (Grounding Lite) requires `X-Goog-Api-Key` header to authenticate requests. Without it, you'll get `403 PERMISSION_DENIED` errors.

## Quick Fix

1. **Get a Google Maps API Key**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to **APIs & Services** → **Credentials**
   - Create a new API key
   - Enable **Maps Grounding Lite API** for your project

2. **Configure in SlashMCP.com Registry**
   - Navigate to `/registry` page
   - Find **"Google Maps MCP (Grounding Lite)"**
   - Click **Edit**
   - In **HTTP Headers (JSON)** field, paste:
     ```json
     {
       "X-Goog-Api-Key": "YOUR_API_KEY_HERE"
     }
     ```
   - Click **Save**

3. **Test**
   - Go to Chat page
   - Try: "Find restaurants near Times Square"
   - Should work without 403 errors

## How It Works

The registry stores HTTP headers in the server's `metadata.httpHeaders` field. When the backend invokes tools on HTTP-based MCP servers, it automatically includes these headers in the fetch request.

### For LangChain Agent

When LangChain agent orchestrates multi-tool queries:
- It discovers available tools from the registry
- When calling Google Maps MCP, the backend automatically forwards the `X-Goog-Api-Key` header
- No additional configuration needed in LangChain

## Troubleshooting

### Error: `403 PERMISSION_DENIED`
- **Cause**: API key missing or invalid
- **Fix**: 
  1. Verify API key is set in registry HTTP Headers
  2. Check API key is valid in Google Cloud Console
  3. Ensure Maps Grounding Lite API is enabled

### Error: `API key not valid`
- **Cause**: API key restrictions or billing not enabled
- **Fix**:
  1. Check API key restrictions in Google Cloud Console
  2. Ensure billing is enabled for your project
  3. Verify API key has access to Maps Grounding Lite API

### Error: `Method doesn't allow unregistered callers`
- **Cause**: API key not being passed in request
- **Fix**:
  1. Verify HTTP Headers are saved correctly (check registry)
  2. Check backend logs for "Google Maps API key present" message
  3. Ensure metadata is being parsed correctly

## API Key Security

- **Never commit API keys to git**
- **Use environment variables** for production
- **Restrict API keys** by:
  - IP address (for production deployments)
  - HTTP referrer (for web apps)
  - API restrictions (limit to Maps Grounding Lite API only)

## Example Configuration

```json
{
  "X-Goog-Api-Key": "AIzaSyCXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
}
```

## Related Documentation

- [Google Maps Grounding Lite API](https://developers.google.com/maps/ai/grounding-lite)
- [Google Cloud API Key Best Practices](https://cloud.google.com/docs/authentication/api-keys)
- [Registry Service Documentation](./API.md)

