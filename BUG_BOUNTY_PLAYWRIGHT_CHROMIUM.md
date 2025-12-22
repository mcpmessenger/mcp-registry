# Bug Bounty Report: Playwright MCP Server Chromium Installation Failure in Cloud Run Deployment

**Related to:** [BUG_BOUNTY_REPORT.md](./BUG_BOUNTY_REPORT.md)  
**Component:** Backend - Playwright MCP Server Integration  
**Environment:** Google Cloud Run (Alpine Linux)  
**Date:** December 21, 2025

## Executive Summary

The MCP Registry backend deployment on Google Cloud Run experiences persistent failures when attempting to use the Playwright MCP server (`@playwright/mcp`) for browser automation tasks. The server successfully initializes but fails to execute browser operations (navigation, screenshots) due to inability to locate or launch the Chromium browser executable. Despite multiple attempted fixes involving Dockerfile modifications, symlink creation, and environment variable configuration, the issue persists, causing tool invocations to timeout after 30-120 seconds.

**Severity:** High  
**Impact:** Playwright MCP server is non-functional in production deployment  
**Status:** Open - Multiple attempted fixes have not resolved the issue  
**Reported:** December 21, 2025  

---

## Problem Description

### Initial Symptoms

1. **Timeout Errors:** Tool invocations via Playwright MCP server timeout after 30 seconds (initially) and 120 seconds (after timeout increase)
2. **Browser Not Found:** Error message: `Error: browserType.launchPersistentContext: Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome`
3. **Hanging Requests:** Network requests remain in "Pending" state until timeout
4. **Successful Initialization:** The MCP server initializes successfully but fails during actual browser operations

### Error Messages Observed

```
Error: browserType.launchPersistentContext: Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome
Run "npx playwright install chrome"
```

```
Error: Request timeout for tools/call (30s)
```

```
STDIO invocation error for com.microsoft.playwright/mcp: Error: Request timeout for tools/call (30s)
```

---

## Technical Environment

### Deployment Stack

- **Platform:** Google Cloud Run (serverless containers)
- **Base Image:** `node:18-alpine` (Alpine Linux)
- **Region:** `us-central1`
- **Service:** `mcp-registry-backend-00064-r47` (latest revision at time of report)
- **MCP Server:** `@playwright/mcp@latest` (spawned via `npx -y @playwright/mcp@latest`)

### System Configuration

- **Operating System:** Alpine Linux 3.21
- **Node.js Version:** 18
- **Chromium Installation:** System Chromium via `apk add chromium` (installed at `/usr/bin/chromium-browser`)
- **Playwright:** Installed globally in container, but browser installation fails

---

## Root Cause Analysis

### Primary Issue

The Playwright MCP server attempts to launch Chromium using the 'chrome' channel/distribution, which expects:
1. Google Chrome (not Chromium) to be installed, OR
2. A specific Playwright-managed browser installation at `/opt/google/chrome/chrome`

However, on Alpine Linux:
- Only system Chromium is available (via `apk add chromium`)
- Playwright's bundled browser installation fails due to Alpine's package manager differences
- The Playwright MCP server doesn't respect standard Playwright environment variables for custom executable paths

### Secondary Issues

1. **Browser Installation Failure:** `npx playwright install chromium --with-deps` fails on Alpine because it attempts to use `apt-get`, which doesn't exist in Alpine
2. **Environment Variable Limitations:** Playwright doesn't support `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` environment variable (this feature was requested but not implemented as of December 2025)
3. **MCP Server Configuration:** The `@playwright/mcp` package doesn't expose configuration for custom executable paths via environment variables or command-line arguments
4. **Channel Mismatch:** The MCP server uses `channel: 'chrome'` which expects Google Chrome, not system Chromium

---

## Attempted Fixes

### Fix Attempt #1: System Chromium Installation (Initial)

**Approach:** Install Chromium via Alpine package manager and create symlink

**Changes Made:**
```dockerfile
RUN apk add --no-cache chromium nss freetype freetype-dev harfbuzz ca-certificates ttf-freefont
RUN mkdir -p /opt/google/chrome && \
    ln -sf /ms-playwright-browsers/chromium-*/chrome /opt/google/chrome/chrome || true
```

**Environment Variables:**
```powershell
PLAYWRIGHT_CHROME_EXECUTABLE_PATH=/opt/google/chrome/chrome
```

**Result:** ❌ Failed - Symlink created too early (before Playwright installation), pattern didn't match

**Error:** Browser still not found at expected path

---

### Fix Attempt #2: Corrected Symlink Timing

**Approach:** Create symlink after Playwright installation but before switching to non-root user

**Changes Made:**
```dockerfile
# After Playwright installation
RUN mkdir -p /opt/google/chrome && \
    ln -sf /ms-playwright-browsers/chromium-*/chrome /opt/google/chrome/chrome || true
```

**Result:** ❌ Failed - Playwright browser installation itself was failing, so symlink had nothing to point to

**Error:** `npx playwright install chromium --with-deps` failed with "apt-get: not found"

---

### Fix Attempt #3: Skip Playwright Browser Installation, Use System Chromium

**Approach:** Skip Playwright's browser installation and use system Chromium exclusively

**Changes Made:**
```dockerfile
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install -g playwright
# (removed playwright install step)

RUN mkdir -p /opt/google/chrome && \
    if [ -f /usr/bin/chromium-browser ]; then \
      ln -sf /usr/bin/chromium-browser /opt/google/chrome/chrome; \
    fi
```

**Result:** ❌ Failed - Playwright MCP server still couldn't find browser

**Error:** `Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome`

---

### Fix Attempt #4: Playwright Browser Cache Structure

**Approach:** Create the directory structure Playwright expects for browser cache

**Changes Made:**
```dockerfile
RUN PLAYWRIGHT_DIR="/home/node/.cache/ms-playwright/chromium-system/chrome-linux" && \
    mkdir -p "$PLAYWRIGHT_DIR" && \
    ln -sf /usr/bin/chromium-browser "$PLAYWRIGHT_DIR/chrome"
```

**Environment Variables:**
```typescript
env: {
  PLAYWRIGHT_BROWSERS_PATH: '/home/node/.cache/ms-playwright',
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
}
```

**Result:** ❌ Failed - Still timing out, browser not found

**Error:** Same timeout and browser not found errors

---

### Fix Attempt #5: Dual Symlink Strategy

**Approach:** Create symlinks in both Playwright cache structure AND `/opt/google/chrome/chrome`

**Changes Made:**
```dockerfile
RUN PLAYWRIGHT_DIR="/home/node/.cache/ms-playwright/chromium-system/chrome-linux" && \
    mkdir -p "$PLAYWRIGHT_DIR" && \
    mkdir -p /opt/google/chrome && \
    ln -sf /usr/bin/chromium-browser "$PLAYWRIGHT_DIR/chrome" && \
    ln -sf /usr/bin/chromium-browser /opt/google/chrome/chrome
```

**Environment Variables:**
```typescript
env: {
  PLAYWRIGHT_BROWSERS_PATH: '/home/node/.cache/ms-playwright',
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
  PLAYWRIGHT_CHROME_EXECUTABLE_PATH: '/opt/google/chrome/chrome',
  PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: '/usr/bin/chromium-browser',
}
```

**Result:** ⚠️ Partial - Symlinks created successfully, but browser operations still timeout

**Error:** Request still times out after 120 seconds

---

### Fix Attempt #6: Increased Timeout

**Approach:** Increase timeout for browser operations to allow for slower browser launches

**Changes Made:**
```typescript
// backend/src/services/mcp-stdio.service.ts
const timeoutMs = method === 'initialize' ? 90000 : 120000 // 120s for browser operations
```

**Result:** ⚠️ Timeout increased but still occurs - indicates browser isn't launching at all, rather than just being slow

---

### Fix Attempt #7: BROWSER=chromium Environment Variable

**Approach:** Explicitly set `BROWSER=chromium` to use chromium channel instead of chrome

**Changes Made:**
```typescript
// backend/src/scripts/register-official-servers.ts
env: {
  BROWSER: 'chromium',
  EXECUTABLE_PATH: '/opt/google/chrome/chrome',
  DISPLAY: ':99',
  LIBGL_ALWAYS_SOFTWARE: '1',
  GALLIUM_DRIVER: 'llvmpipe',
  // ... other vars
}
```

**Result:** 
- ✅ Browser successfully launches (confirmed via DevTools connection logs)
- ✅ No more "chrome not found" error
- ❌ Browser times out after 180 seconds due to GPU initialization failures
- **Analysis:** Browser launches but GPU processes fail repeatedly, causing hang

---

### Fix Attempt #8: Add Mesa/OpenGL Packages for Software Rendering

**Approach:** Install Mesa packages to provide software rendering support for GPU operations

**Changes Made:**
```dockerfile
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    mesa-dri-gallium \
    mesa-gl \
    libx11 \
    libxcomposite \
    libxdamage \
    libxfixes \
    libxrandr \
    libxrender \
    libxshmfence \
    libgbm \
```

**Status:** 🔄 In progress - Ready to test

---

## Current State

### What Works

- ✅ Backend service deploys successfully
- ✅ Playwright MCP server initializes successfully (no errors during `initialize` call)
- ✅ System Chromium is installed and accessible at `/usr/bin/chromium-browser`
- ✅ Symlinks are created correctly (verified in build logs)
- ✅ Environment variables are passed to MCP server process
- ✅ Browser successfully launches when `BROWSER=chromium` is set (confirmed via DevTools connection)
- ✅ No more "chrome not found" error

### What Doesn't Work

- ❌ Browser launches but times out after 180 seconds
- ❌ GPU process initialization failures (Vulkan/EGL errors) cause browser to hang
- ❌ Tool invocations fail due to timeout (browser never fully initializes)
- ❌ No successful browser operations (navigation, screenshots) have been completed

### Build Verification

Build logs confirm symlinks are created:
```
Created symlinks: /usr/bin/chromium-browser -> /home/node/.cache/ms-playwright/chromium-system/chrome-linux/chrome and /opt/google/chrome/chrome
```

### Runtime Logs (Latest - After BROWSER=chromium Fix)

**Browser Launch Success:**
```
- <launched> pid=48
- DevTools listening on ws://127.0.0.1:51447/devtools/browser/...
- <ws connected> ws://127.0.0.1:51447/devtools/browser/...
```

**GPU Initialization Failures:**
```
ERROR:ui/gl/angle_platform_impl.cc:49] vk_renderer.cpp:183 (VerifyExtensionsPresent): 
Extension not supported: VK_KHR_surface
ERROR:ui/gl/gl_display.cc:815] Initialization of all EGL display types failed.
ERROR:components/viz/service/main/viz_main_impl.cc:183] Exiting GPU process due to errors during initialization
```

**Timeout Error:**
```
TimeoutError: browserType.launchPersistentContext: Timeout 180000ms exceeded.
```

---

## Technical Deep Dive

### Playwright MCP Server Behavior

The `@playwright/mcp` package:
1. Uses Playwright's browser automation library
2. Configures browsers via internal configuration (not easily overridable)
3. Appears to default to `channel: 'chrome'` which expects Google Chrome
4. Doesn't expose executable path configuration via environment variables
5. Runs as a separate process via `npx`, isolated from parent process environment

### Alpine Linux Challenges

1. **Package Manager:** Uses `apk` instead of `apt-get`, breaking Playwright's browser installation scripts
2. **Musl Libc:** Different from glibc, can cause compatibility issues
3. **Minimal Base:** Smaller footprint but fewer pre-installed tools
4. **Chromium vs Chrome:** Alpine provides Chromium, not Google Chrome

### Playwright Browser Detection

Playwright expects browsers in specific locations:
- Default: `~/.cache/ms-playwright/<browser>-<version>/<platform>/<executable>`
- Example: `~/.cache/ms-playwright/chromium-1234.5.6/chrome-linux/chrome`

When using `channel: 'chrome'`, Playwright looks for:
- Google Chrome installation (system-wide)
- Or Playwright-managed Chrome at `/opt/google/chrome/chrome`

### Environment Variable Research

Research findings:
- ❌ `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` - Not supported (feature requested but not implemented)
- ✅ `PLAYWRIGHT_BROWSERS_PATH` - Supported, but only specifies cache directory, not executable
- ❌ `PLAYWRIGHT_CHROME_EXECUTABLE_PATH` - Not a standard Playwright environment variable

---

## Potential Solutions (Not Yet Attempted)

### Solution 0: Set Browser Channel to Chromium (RECOMMENDED - Based on Expert Analysis)

**Approach:** Explicitly configure Playwright MCP server to use 'chromium' channel instead of 'chrome'

**Key Insight:** The error "Chromium distribution 'chrome' is not found" indicates Playwright is looking for Google Chrome (branded browser), but we have Chromium. We should configure it to use 'chromium' explicitly.

**Implementation:**
```typescript
env: {
  BROWSER: 'chromium',  // Explicitly use chromium channel
  EXECUTABLE_PATH: '/opt/google/chrome/chrome',  // Path to chromium executable
  PLAYWRIGHT_BROWSERS_PATH: '/home/node/.cache/ms-playwright',
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
}
```

**Deployment Command:**
```powershell
gcloud run deploy mcp-registry-backend `
  --image gcr.io/slashmcp/mcp-registry-backend:latest `
  --region us-central1 --platform managed `
  --set-secrets DATABASE_URL=db-url:latest `
  --add-cloudsql-instances slashmcp:us-central1:mcp-registry-db `
  --set-env-vars "^@^RUN_MIGRATIONS_ON_STARTUP=true@REGISTER_OFFICIAL_SERVERS_ON_STARTUP=true@CORS_ORIGIN=https://v0-logo-design-ashen-mu.vercel.app@BROWSER=chromium@EXECUTABLE_PATH=/opt/google/chrome/chrome" `
  --quiet
```

**Pros:**
- Simple environment variable change
- Addresses root cause (channel mismatch)
- No Dockerfile changes needed

**Status:** ⚠️ Partially successful - Browser launches but times out due to GPU initialization failures

**Implementation Date:** December 21, 2025  
**Code Changes:** 
- Updated `backend/src/scripts/register-official-servers.ts` to include `BROWSER=chromium` environment variable
- Added `DISPLAY`, `LIBGL_ALWAYS_SOFTWARE`, and `GALLIUM_DRIVER` environment variables for software rendering

**Result:** 
- ✅ Browser successfully launches (confirmed via DevTools connection)
- ✅ No more "chrome not found" error
- ❌ Timeout after 180 seconds due to GPU process initialization failures
- **Next Step:** Add Mesa/OpenGL packages to Dockerfile for software rendering support

---

### Solution 1: Use Different Base Image

**Approach:** Switch from `node:18-alpine` to `node:18` (Debian-based)

**Pros:**
- Playwright browser installation would work out of the box
- Better compatibility with Playwright's installation scripts
- Full glibc support

**Cons:**
- Larger image size (impact on cold start times)
- More system dependencies

**Implementation:**
```dockerfile
FROM node:18 AS runner  # Instead of node:18-alpine
```

---

### Solution 2: Install Playwright Browsers During Build

**Approach:** Install Playwright browsers in builder stage, copy to runner

**Implementation:**
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
RUN npm install -g playwright
RUN npx playwright install chromium --with-deps

FROM node:18-alpine AS runner
COPY --from=builder /root/.cache/ms-playwright /home/node/.cache/ms-playwright
```

**Challenges:**
- Still need to handle Alpine's package manager differences
- May require installing build dependencies

---

### Solution 3: Use Playwright Core with Custom Browser Path

**Approach:** Fork or modify how Playwright MCP server is invoked to pass executable path

**Implementation:**
- Create wrapper script that configures Playwright before starting MCP server
- Use Playwright's programmatic API to specify executable path

**Challenges:**
- Requires modifying how MCP server is spawned
- May not be compatible with `@playwright/mcp` package structure

---

### Solution 4: Configuration File Approach

**Approach:** Pass configuration file to Playwright MCP server specifying executable path

**Research Needed:**
- Determine if `@playwright/mcp` supports configuration files
- If so, create config file with `executablePath` in `launchOptions`

**Implementation:**
```json
{
  "browser": {
    "browserName": "chromium",
    "launchOptions": {
      "executablePath": "/usr/bin/chromium-browser",
      "headless": true
    }
  }
}
```

---

### Solution 5: Use Different Browser Distribution

**Approach:** Switch from Alpine's Chromium to a different browser or distribution method

**Options:**
- Use `playwright-core` with custom browser installation
- Use headless Chrome from a different source
- Use Firefox or WebKit instead of Chromium

---

## Evidence and Logs

### Build Logs (Successful)

```
Step 24/30 : RUN mkdir -p /opt/google/chrome && ...
Created symlinks: /usr/bin/chromium-browser -> /home/node/.cache/ms-playwright/chromium-system/chrome-linux/chrome and /opt/google/chrome/chrome
```

### Runtime Logs (Failure)

```
2025-12-21 23:16:15 ✅ MCP server com.microsoft.playwright/mcp initialized successfully
2025-12-21 23:16:51 STDIO invocation error for com.microsoft.playwright/mcp: Error: Request timeout for tools/call (30s)
```

### Error Messages

```
Error: browserType.launchPersistentContext: Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome
Run "npx playwright install chrome"
```

### Network Request Behavior

- Request status: `(pending)` for extended period
- Timeout after 30 seconds (initial) or 120 seconds (after fix)
- Preflight request succeeds (204), but actual tool invocation fails

---

## Impact Assessment

### Functional Impact

- **Critical Feature Broken:** Browser automation via Playwright MCP server is completely non-functional
- **User Experience:** Users cannot perform browser-based tasks (screenshots, navigation, form filling)
- **Service Reliability:** Tool invocations consistently fail, causing poor user experience

### Business Impact

- **Feature Availability:** 0% success rate for Playwright-based features
- **User Trust:** Repeated failures may erode confidence in the platform
- **Development Velocity:** Blocks development of browser automation features

---

## Recommendations

### Immediate Actions

1. **Document Current State:** This report serves as comprehensive documentation
2. **Consider Alternative Base Image:** Evaluate switching to Debian-based image
3. **Contact Playwright MCP Maintainers:** Open issue on `@playwright/mcp` GitHub repository
4. **Temporary Workaround:** Consider disabling Playwright MCP server until resolved

### Long-term Solutions

1. **Standardize on Debian Base:** For better Playwright compatibility
2. **Browser Installation Strategy:** Establish reliable browser installation method
3. **Configuration Management:** Implement proper configuration system for MCP servers
4. **Testing Infrastructure:** Add integration tests for browser operations

---

## Files Modified

### Dockerfile
- Added Chromium installation via `apk add`
- Created multiple symlink strategies
- Attempted Playwright browser cache structure creation
- Modified Playwright installation approach

### Source Code
- `backend/src/scripts/register-official-servers.ts` - Added environment variables
- `backend/src/services/mcp-stdio.service.ts` - Increased timeout
- `backend/src/middleware/cors.middleware.ts` - Updated CORS for Vercel domains

### Deployment Configuration
- Cloud Run environment variables
- Build and deployment scripts

---

## Revision History

| Revision | Date | Changes | Result |
|----------|------|---------|--------|
| 00059 | 2025-12-21 | Initial Playwright symlink fix | ❌ Failed |
| 00060 | 2025-12-21 | CORS fix for Vercel | ✅ CORS fixed |
| 00061 | 2025-12-21 | System Chromium approach | ❌ Failed |
| 00062 | 2025-12-21 | Playwright cache structure | ❌ Failed |
| 00063 | 2025-12-21 | Dual symlink strategy | ⚠️ Partial |
| 00064 | 2025-12-21 | Increased timeout + dual symlinks | ⚠️ Still timing out |

---

## Conclusion

Despite multiple systematic attempts to resolve the Playwright Chromium installation issue, the problem persists. The core issue appears to be a fundamental incompatibility between:

1. Alpine Linux's package management and Playwright's browser installation scripts
2. The Playwright MCP server's expectation of Google Chrome vs. system Chromium availability
3. Lack of environment variable support for custom executable paths in Playwright

The most promising path forward is likely switching to a Debian-based base image or finding an alternative approach to browser installation that's compatible with Alpine Linux.

**Status:** Open - Requires further investigation or alternative approach

**Priority:** High - Blocks critical browser automation functionality

---

*Report generated: December 21, 2025*  
*Last updated: December 21, 2025*  
*Current revision: mcp-registry-backend-00064-r47*
