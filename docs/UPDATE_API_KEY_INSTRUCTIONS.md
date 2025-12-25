# Update API Key - Quick Instructions

## ✅ Your API Key (Validated)
```
AIzaSyCQeNta_oe4A-xlURzdEYZlx31-XsPIsAA
```

This key has been tested and is **valid** ✅

## Option 1: Update via UI (Easiest)

1. **Go to SlashMCP.com**
   - Open your deployed frontend (Vercel URL)
   - Navigate to the **Registry** page

2. **Find Nano Banana MCP**
   - Look for "Nano Banana MCP" in the server list
   - Click the **Edit** button (pencil icon)

3. **Update Credentials**
   - Find the **Credentials** or **Environment Variables** field
   - Paste your new API key: `AIzaSyCQeNta_oe4A-xlURzdEYZlx31-XsPIsAA`
   - Or if there's a JSON format, use:
     ```json
     {
       "GEMINI_API_KEY": "AIzaSyCQeNta_oe4A-xlURzdEYZlx31-XsPIsAA",
       "API_KEY": "AIzaSyCQeNta_oe4A-xlURzdEYZlx31-XsPIsAA"
     }
     ```

4. **Save**
   - Click **Save** or **Update**
   - Wait for confirmation

5. **Test**
   - Go to Chat page
   - Select "Nano Banana MCP" from the agent dropdown
   - Try: "make me a picture of a kitty"
   - With billing enabled, it should work! 🎉

## Option 2: Direct Database Update (If you have access)

If you have direct database access, you can update the `env` field directly:

```sql
UPDATE "McpServer" 
SET env = jsonb_set(
  COALESCE(env, '{}'::jsonb), 
  '{GEMINI_API_KEY}', 
  '"AIzaSyCQeNta_oe4A-xlURzdEYZlx31-XsPIsAA"'::jsonb
)
WHERE "serverId" = 'com.mcp-registry/nano-banana-mcp';

UPDATE "McpServer" 
SET env = jsonb_set(
  COALESCE(env, '{}'::jsonb), 
  '{API_KEY}', 
  '"AIzaSyCQeNta_oe4A-xlURzdEYZlx31-XsPIsAA"'::jsonb
)
WHERE "serverId" = 'com.mcp-registry/nano-banana-mcp';
```

## Option 3: Re-register the Server

If the above don't work, you can delete and re-register:

1. Delete "Nano Banana MCP" from the registry
2. Re-register it with the new API key in the credentials field

## Verify It's Working

After updating, test it:

1. Go to Chat page
2. Select "Nano Banana MCP"
3. Type: "make me a picture of a kitty"
4. You should get an image (not a quota error)

## With Billing Enabled

Since you enabled billing, you should have:
- ✅ Higher quotas for image generation
- ✅ Access to `gemini-2.5-flash-preview-image` model
- ✅ No more "quota exceeded" errors (unless you hit daily limits)

## Troubleshooting

**Still getting quota errors?**
- Check your quota: https://ai.dev/usage?tab=rate-limit
- Verify billing is enabled: https://console.cloud.google.com/billing
- Wait a few minutes for changes to propagate

**API key not working?**
- Verify the key is correct (starts with `AIza...`)
- Check the key is saved in both `GEMINI_API_KEY` and `API_KEY` fields
- Try regenerating the key if needed

