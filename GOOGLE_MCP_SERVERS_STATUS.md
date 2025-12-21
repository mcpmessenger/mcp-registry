# Google MCP Servers Status

## Current Status

### ✅ Available Now
- **Microsoft Playwright MCP** (`@playwright/mcp`) - ✅ Published and working
  - Package: `@playwright/mcp@latest`
  - Status: Available on npm
  - Can be used immediately

### ⏳ Coming Soon (Not Yet Published)
- **Google Maps MCP** (`@google/maps-mcp`) - ⏳ Not published yet
  - Package: `@google/maps-mcp` 
  - Status: **404 Not Found** on npm registry
  - Error: "Package not found"
  
- **Google BigQuery MCP** (`@google/bigquery-mcp`) - ⏳ Not published yet
  - Package: `@google/bigquery-mcp`
  - Status: **404 Not Found** on npm registry
  - Error: "Package not found"

## Why This Happens

According to [Google's announcement](https://cloud.google.com/blog/products/ai-machine-learning/announcing-official-mcp-support-for-google-services):

> "We are incrementally releasing MCP support for all our services"

Google is rolling out MCP servers incrementally. The packages will be published to npm as they become available.

## What We've Done

1. ✅ **Updated registration script** - Only registers Playwright (available)
2. ✅ **Better error messages** - Explains when packages don't exist
3. ✅ **Increased timeouts** - 90 seconds for initialization (in case packages are downloading)
4. ✅ **Improved logging** - Shows what's happening during spawn/init

## Testing Playwright (Available)

You can test the **Playwright MCP Server** right now:

1. Select "Playwright MCP Server" in the chat
2. Try: "Navigate to https://example.com and take a screenshot"

This should work because `@playwright/mcp` is published on npm.

## When Google Servers Are Available

Once Google publishes the packages:

1. **Uncomment** the Google servers in `register-official-servers.ts`
2. **Run** `npm run register-official` again
3. They'll be available immediately

## Current Error Messages

If you try to use Google Maps/BigQuery servers, you'll see:

```
Failed to invoke tool via STDIO: MCP server initialization timeout
or
Package not found: @google/maps-mcp
```

This is expected - the packages aren't published yet.

## Next Steps

1. ✅ **Use Playwright** - It's available and working
2. ⏳ **Wait for Google** - They're rolling out incrementally
3. 🔔 **Monitor** - Check npm registry periodically:
   ```bash
   npm view @google/maps-mcp
   npm view @google/bigquery-mcp
   ```

## Summary

- **Playwright**: ✅ Ready to use
- **Google Maps**: ⏳ Coming soon (not published)
- **Google BigQuery**: ⏳ Coming soon (not published)

The system is ready - we just need to wait for Google to publish the packages!

