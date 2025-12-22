# Fixing Playwright GPU/Timeout Issues

## Problem

When using the Playwright MCP server in headless environments (like Docker containers or Cloud Run), you may encounter timeout errors like:

```
TimeoutError: browserType.launchPersistentContext: Timeout 180000ms exceeded.
```

This happens because Chrome/Chromium is trying to use GPU acceleration (Vulkan) which isn't available in headless environments.

## Solution

The Playwright MCP server has been updated with environment variables to disable GPU acceleration. However, the `@playwright/mcp` package itself needs to pass the right flags to Chrome.

### Option 1: Use Updated Registration (Already Done)

The Playwright server has been re-registered with:
- `--headless` flag
- `--browser chromium` flag
- Environment variables for GPU disabling

Try using Playwright again through the MCP registry.

### Option 2: Use Playwright Directly (Workaround)

If the MCP server still has issues, you can use Playwright directly with proper configuration:

1. **Install Playwright:**
   ```bash
   cd backend
   npm install playwright
   npx playwright install chromium
   ```

2. **Use the screenshot script:**
   ```bash
   npx ts-node scripts/screenshot-wikipedia.ts
   ```

### Option 3: Configure Playwright MCP Server Environment

The Playwright MCP server should respect these environment variables when launching Chrome:

- `DISPLAY=:99` - Virtual display for headless
- `PLAYWRIGHT_BROWSER_LAUNCH_TIMEOUT=120000` - Increase timeout
- Chrome flags: `--disable-gpu --use-gl=swiftshader --no-sandbox --disable-dev-shm-usage`

However, the `@playwright/mcp` package may need to be updated to properly pass these flags to Chrome.

## Testing

1. Try using Playwright through the MCP registry again
2. If it still times out, check the backend logs for more details
3. As a workaround, use the direct Playwright script in `scripts/screenshot-wikipedia.ts`

## Future Improvements

- The `@playwright/mcp` package may need updates to better support headless environments
- Consider using `playwright-core` with `@sparticuz/chromium` for serverless environments
- Monitor the Playwright MCP repository for updates: https://github.com/microsoft/playwright-mcp
