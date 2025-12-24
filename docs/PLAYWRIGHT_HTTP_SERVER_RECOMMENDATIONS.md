# Playwright HTTP Server - Technical & Security Recommendations

## Overview
The Playwright HTTP server (`mcpmessenger/playwright-mcp`) is a serverless service that exists to serve the MCP Registry. This document provides recommendations for fixing the browser lock issue and securing the public-facing service.

---

## 🔧 Technical Fix: Browser Lock Issue

### Problem
When multiple requests call `browser_navigate` or other browser tools, the server fails with:
```
Error: Browser is already in use for /root/.cache/ms-playwright/mcp-chrome, use --isolated to run multiple instances of the same browser
```

### Root Cause
The Playwright MCP server spawns a single browser instance that's shared across requests. When a browser operation doesn't fully complete, subsequent requests fail because the browser process is locked.

### Recommended Solutions

#### Option 1: Use Isolated Browser Instances (Recommended)
Modify `src/playwright-process.ts` to pass `--isolated` flag to Playwright:

```typescript
// In src/playwright-process.ts, modify the spawn command:
const proc = spawn("npx", ["-y", "@playwright/mcp@latest", "--isolated"], {
  stdio: ["pipe", "pipe", "pipe"],
  shell: process.platform === "win32",
});
```

**Pros:**
- Allows multiple concurrent browser operations
- Minimal code changes
- Better for serverless (handles concurrent requests)

**Cons:**
- Slightly higher memory usage per request

#### Option 2: Per-Request Browser Context Management
Create a new browser context for each request and properly clean it up:

```typescript
// Pseudo-code for per-request browser management
async function handleRequest(request) {
  const context = await browser.newContext({ isolated: true })
  try {
    // Process request
    return await processWithContext(context, request)
  } finally {
    await context.close()
  }
}
```

**Pros:**
- Better resource management
- Prevents browser lock issues
- More scalable

**Cons:**
- Requires more significant refactoring

#### Option 3: Browser Pool with Queue
Implement a browser pool that queues requests when all browsers are in use:

```typescript
class BrowserPool {
  private browsers: Browser[] = []
  private queue: Request[] = []
  
  async acquire(): Promise<Browser> {
    // Get available browser or create new one
    // Queue request if all busy
  }
  
  async release(browser: Browser): Promise<void> {
    // Return browser to pool
  }
}
```

**Pros:**
- Handles high concurrency
- Resource efficient
- Prevents lock issues

**Cons:**
- Most complex implementation
- Requires queue management

### Implementation Priority
1. **Short-term**: Option 1 (--isolated flag) - Quick fix, minimal changes
2. **Long-term**: Option 2 (Per-request contexts) - Better architecture for serverless

---

## 🔒 Security Recommendations

### Current State
The Playwright HTTP server is currently **open/public** (no authentication required) to enable beta and investor testing.

### Security Concerns
1. **No rate limiting** - Vulnerable to abuse/DDoS
2. **No authentication** - Anyone can use the service
3. **Resource exhaustion** - Malicious users could spawn many browsers
4. **No request validation** - Could receive malicious URLs/scripts

### Recommended Security Measures

#### 1. Rate Limiting (Critical)
Implement rate limiting to prevent abuse:

```typescript
// Using express-rate-limit or similar
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
})

app.use('/mcp', limiter)
```

**Cloud Run Implementation:**
```bash
gcloud run services update playwright-mcp-http-server \
  --max-instances 10 \
  --concurrency 10 \
  --cpu-throttling \
  --region us-central1
```

#### 2. Request Validation (Critical)
Validate and sanitize all inputs:

```typescript
// Validate URLs before navigation
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Whitelist allowed domains for beta
    const allowedDomains = [
      'google.com',
      'wikipedia.org',
      'example.com',
      // Add more as needed
    ]
    return allowedDomains.some(domain => parsed.hostname.endsWith(domain))
  } catch {
    return false
  }
}

// Validate tool arguments
function validateToolArgs(tool: string, args: any): boolean {
  if (tool === 'browser_navigate') {
    return isValidUrl(args.url)
  }
  // Add validation for other tools
  return true
}
```

#### 3. Timeout Limits (Important)
Set strict timeouts to prevent resource exhaustion:

```typescript
// Set maximum execution time per request
const MAX_EXECUTION_TIME = 30000 // 30 seconds

app.use('/mcp', (req, res, next) => {
  req.setTimeout(MAX_EXECUTION_TIME)
  next()
})
```

#### 4. Resource Limits (Important)
Limit browser instances and memory usage:

```typescript
// Track active browser instances
let activeBrowsers = 0
const MAX_BROWSERS = 5

async function createBrowser(): Promise<Browser> {
  if (activeBrowsers >= MAX_BROWSERS) {
    throw new Error('Maximum browser instances reached. Please try again later.')
  }
  activeBrowsers++
  // Create browser...
}
```

#### 5. Optional: API Key Authentication (For Production)
For production, consider API key authentication:

```typescript
// Simple API key check
const API_KEYS = process.env.ALLOWED_API_KEYS?.split(',') || []

app.use('/mcp', (req, res, next) => {
  const apiKey = req.headers['x-api-key']
  if (!API_KEYS.includes(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' })
  }
  next()
})
```

**Cloud Run Implementation:**
```bash
# Store API keys in Secret Manager
gcloud secrets create playwright-api-keys --data-file=api-keys.txt

# Update service to read from secret
gcloud run services update playwright-mcp-http-server \
  --set-secrets "ALLOWED_API_KEYS=playwright-api-keys:latest" \
  --region us-central1
```

#### 6. Monitoring & Alerting (Recommended)
Set up monitoring for abuse detection:

```typescript
// Track request patterns
const requestTracker = new Map<string, number>()

app.use('/mcp', (req, res, next) => {
  const ip = req.ip
  const count = requestTracker.get(ip) || 0
  requestTracker.set(ip, count + 1)
  
  // Alert if suspicious activity
  if (count > 1000) {
    console.error(`Suspicious activity from IP: ${ip}`)
    // Send alert to monitoring service
  }
  next()
})
```

### Security Implementation Priority

**Phase 1 (Immediate - Beta Testing):**
1. ✅ Rate limiting (100 requests per 15 minutes per IP)
2. ✅ Request validation (URL whitelist)
3. ✅ Timeout limits (30 seconds max)
4. ✅ Resource limits (max 5 concurrent browsers)

**Phase 2 (Before Public Launch):**
5. API key authentication (optional, for premium users)
6. Monitoring & alerting
7. Request logging & audit trail

**Phase 3 (Production):**
8. OAuth 2.0 integration (if needed)
9. Advanced threat detection
10. Geographic restrictions (if needed)

---

## 📋 Implementation Checklist

### Browser Lock Fix
- [ ] Add `--isolated` flag to Playwright spawn command
- [ ] Test with concurrent requests
- [ ] Verify no more "Browser is already in use" errors
- [ ] Monitor memory usage with isolated instances

### Security Hardening
- [ ] Implement rate limiting (100 req/15min per IP)
- [ ] Add URL validation/whitelist
- [ ] Set request timeouts (30 seconds)
- [ ] Limit concurrent browser instances (max 5)
- [ ] Add request logging
- [ ] Set up Cloud Run resource limits
- [ ] (Optional) Add API key authentication
- [ ] (Optional) Set up monitoring/alerting

---

## 🧪 Testing Recommendations

### Test Browser Lock Fix
```bash
# Test concurrent requests
for i in {1..5}; do
  curl -X POST https://playwright-mcp-http-server-554655392699.us-central1.run.app/mcp \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":'$i',"method":"tools/call","params":{"name":"browser_navigate","arguments":{"url":"https://example.com"}}}' &
done
wait
```

### Test Rate Limiting
```bash
# Send 150 requests (should hit rate limit)
for i in {1..150}; do
  curl -X POST https://playwright-mcp-http-server-554655392699.us-central1.run.app/mcp \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":'$i',"method":"tools/call","params":{"name":"browser_navigate","arguments":{"url":"https://example.com"}}}'
done
```

### Test URL Validation
```bash
# Should fail (malicious URL)
curl -X POST https://playwright-mcp-http-server-554655392699.us-central1.run.app/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"browser_navigate","arguments":{"url":"file:///etc/passwd"}}}'
```

---

## 📝 Notes for Server Team

1. **Serverless Architecture**: The service runs on Cloud Run, which handles scaling automatically. Ensure browser cleanup happens quickly to avoid cold starts.

2. **Memory Management**: Isolated browser instances use more memory. Monitor Cloud Run memory usage and adjust `--memory` flag if needed.

3. **Concurrency**: Cloud Run can handle multiple concurrent requests. The browser pool approach (Option 3) works well with Cloud Run's concurrency model.

4. **Cost Optimization**: Rate limiting and resource limits help control costs by preventing abuse.

5. **Beta vs Production**: Current open access is fine for beta, but implement Phase 1 security measures before public launch.

---

## 🔗 Related Documentation
- [Playwright Browser Lock Issue](./PLAYWRIGHT_BROWSER_LOCK_ISSUE.md)
- [Playwright Browser Lock Fix](./PLAYWRIGHT_BROWSER_LOCK_FIX.md)
- [MCP Registry Backend Documentation](../backend/README.md)





