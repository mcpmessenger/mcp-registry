# Playwright Bot Detection Issues

## Problem

Some websites (like Ticketmaster) have strong bot detection mechanisms that block automated browser access, resulting in:
- **403 Forbidden** errors
- **"Your Browsing Activity Has Been Paused"** pages
- **CAPTCHA challenges**
- **Access blocked** messages

## Current Status

✅ **Working**: Playwright MCP tool is correctly routing and executing  
⚠️ **Limitation**: Bot detection prevents full access to protected sites

## Example Response

When accessing Ticketmaster, Playwright successfully navigates but gets blocked:

```
Page URL: https://www.ticketmaster.com/
Page Title: (empty)
Status: 403 Forbidden
Message: "We've detected unusual behavior on either your network or your browser."
```

## Solutions

### 1. Stealth Playwright (Recommended)

The Playwright MCP server can implement stealth techniques:

```typescript
// In Playwright MCP server
import { chromium } from 'playwright'

const browser = await chromium.launch({
  headless: false, // Some sites detect headless browsers
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-sandbox',
  ]
})

const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  locale: 'en-US',
})

// Remove automation indicators
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => false })
  window.navigator.chrome = { runtime: {} }
})
```

### 2. Playwright Stealth Plugin

Use `playwright-extra` with `puppeteer-extra-plugin-stealth`:

```bash
npm install playwright-extra puppeteer-extra-plugin-stealth
```

### 3. Proxy/VPN Rotation

Rotate IP addresses to avoid rate limiting and detection.

### 4. Browser Headers

Set realistic browser headers:

```typescript
await page.setExtraHTTPHeaders({
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
})
```

### 5. Rate Limiting

Add delays between requests to appear more human-like.

## Workarounds for Users

If bot detection blocks access:

1. **Try Alternative Sources**: Use official APIs or RSS feeds instead of scraping
2. **Manual Access**: For one-time queries, manually check the website
3. **Different Website**: Some sites are more bot-friendly than others
4. **Scheduled Retry**: Some blocks are temporary

## For Playwright MCP Server Team

**Recommended Enhancements**:

1. **Add Stealth Mode**: Implement stealth techniques by default
2. **User-Agent Rotation**: Rotate realistic user agents
3. **Cookie Management**: Handle cookies and sessions properly
4. **Error Handling**: Provide clear messages about bot detection
5. **Retry Logic**: Automatic retry with different headers/strategies

## Related Documentation

- [Playwright Stealth Guide](https://playwright.dev/docs/verification)
- [Bot Detection Bypass Techniques](https://playwright.dev/docs/best-practices)
- [Playwright MCP Server README](../tmp-playwright-mcp/README.md)

