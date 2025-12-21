# Product Requirements Document: Playwright MCP HTTP Server

**Version:** 1.0  
**Date:** December 2024  
**Status:** Draft  
**Owner:** Development Team

---

## 1. Executive Summary

Build a standalone HTTP service that wraps the official `@playwright/mcp` package to provide browser automation capabilities via HTTP endpoints. This service will enable the MCP Registry platform to use Playwright MCP in serverless environments where STDIO-based communication is not possible.

**Key Value Proposition:**
- Enable Playwright MCP functionality in serverless/cloud environments
- Provide a scalable, independently deployable service
- Maintain compatibility with the MCP (Model Context Protocol) specification
- Support browser automation operations (navigation, screenshots, DOM interaction)

---

## 2. Problem Statement

### Current State
- Playwright MCP typically runs via STDIO (stdin/stdout) requiring a long-running backend process
- STDIO mode doesn't work in serverless environments (Vercel, AWS Lambda, Cloudflare Workers)
- The MCP Registry backend needs to support Playwright but may be deployed on serverless platforms
- STDIO mode ties Playwright lifecycle to backend lifecycle (restarting backend kills Playwright sessions)

### Desired State
- Playwright runs as an independent HTTP service
- Backend can call Playwright via standard HTTP requests
- Works with any backend deployment model (serverless or traditional)
- Playwright service can scale independently
- Browser sessions persist across backend restarts

---

## 3. Goals and Objectives

### Primary Goals
1. **Deployability**: Run as a standalone service on platforms like Railway, Render, Fly.io, or Docker
2. **Compatibility**: Fully compatible with MCP v0.1 specification
3. **Performance**: Minimal latency overhead compared to STDIO (target: <100ms additional latency)
4. **Reliability**: Handle concurrent requests and maintain browser session state
5. **Scalability**: Support multiple concurrent browser sessions

### Success Metrics
- Service uptime > 99.5%
- Average response time < 2s for screenshot operations
- Support for 10+ concurrent browser sessions
- Zero configuration required beyond deployment URL
- Full compatibility with existing MCP Registry frontend

---

## 4. Technical Requirements

### 4.1 Core Technology Stack
- **Runtime**: Node.js 18+ (LTS)
- **Package**: `@playwright/mcp@latest` (official Microsoft package)
- **HTTP Framework**: Express.js or Fastify (lightweight)
- **Protocol**: MCP (Model Context Protocol) v0.1 over HTTP
- **Browser**: Chromium (headless mode for server environments)

### 4.2 Required Features

#### 4.2.1 MCP Protocol Support
- Implement MCP v0.1 specification endpoints
- Support JSON-RPC 2.0 message format
- Handle `initialize` handshake
- Support `tools/list` endpoint
- Support `tools/call` endpoint
- Support notifications and subscriptions

#### 4.2.2 Browser Operations
Must support all Playwright MCP tools:
- `browser_navigate` - Navigate to URLs
- `browser_snapshot` - Get accessibility snapshot
- `browser_take_screenshot` - Capture screenshots
- `browser_click` - Click elements
- `browser_type` - Type text
- `browser_fill_form` - Fill forms
- `browser_evaluate` - Execute JavaScript
- `browser_wait_for` - Wait for conditions
- `browser_close` - Close browser/page
- Additional tools as supported by `@playwright/mcp`

#### 4.2.3 Session Management
- Support multiple concurrent browser sessions
- Session isolation (each request can use different session)
- Optional: Session persistence across requests
- Cleanup of stale sessions

#### 4.2.4 Error Handling
- Graceful error handling and reporting
- Browser crash recovery
- Timeout handling for long-running operations
- Validation of request parameters

### 4.3 Non-Functional Requirements

#### Performance
- Startup time: < 10 seconds
- Screenshot latency: < 2 seconds
- Navigation latency: < 1 second
- Support 10+ concurrent requests

#### Reliability
- Auto-restart on crash
- Health check endpoint (`/health`)
- Graceful shutdown handling
- Resource cleanup on exit

#### Security
- Input validation (URL sanitization, XSS prevention)
- Rate limiting (optional but recommended)
- CORS configuration
- Request size limits

#### Observability
- Request logging
- Error logging
- Performance metrics (optional)
- Health status endpoint

---

## 5. Architecture & Design

### 5.1 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Playwright MCP HTTP Service            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐      ┌──────────────┐               │
│  │  HTTP Server │──────│  MCP Router  │               │
│  │  (Express)   │      │  Handler     │               │
│  └──────────────┘      └──────────────┘               │
│         │                      │                        │
│         │                      ▼                        │
│         │            ┌──────────────────┐               │
│         │            │  @playwright/mcp │               │
│         │            │  (STDIO Wrapper) │               │
│         │            └──────────────────┘               │
│         │                      │                        │
│         │                      ▼                        │
│         │            ┌──────────────────┐               │
│         │            │  Playwright      │               │
│         │            │  Browser Engine  │               │
│         │            └──────────────────┘               │
│         │                                               │
│         ▼                                               │
│  ┌──────────────┐                                      │
│  │  Health/     │                                      │
│  │  Metrics     │                                      │
│  └──────────────┘                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Component Design

#### 5.2.1 HTTP Server Component
- **Responsibility**: Handle incoming HTTP requests, parse JSON-RPC messages, return responses
- **Endpoints**:
  - `POST /mcp` - Main MCP protocol endpoint
  - `GET /health` - Health check
  - `GET /` - Service info

#### 5.2.2 MCP Protocol Handler
- **Responsibility**: Bridge HTTP requests to STDIO-based `@playwright/mcp` package
- **Implementation**: Spawn `npx @playwright/mcp@latest` as child process, communicate via stdin/stdout
- **Session Management**: Map HTTP requests to Playwright processes

#### 5.2.3 Configuration
- Environment variables for configuration
- Default values for all settings
- Runtime configuration validation

### 5.3 Data Flow

```
Client Request (HTTP)
    │
    ▼
HTTP Server (Express)
    │
    ▼
Parse JSON-RPC Message
    │
    ▼
Route to MCP Handler
    │
    ▼
Spawn/Use Playwright Process (STDIO)
    │
    ▼
Execute Browser Operation
    │
    ▼
Format Response (JSON-RPC)
    │
    ▼
HTTP Response to Client
```

---

## 6. API Specification

### 6.1 Endpoints

#### POST /mcp
Main MCP protocol endpoint. Accepts JSON-RPC 2.0 messages.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "browser_navigate",
    "arguments": {
      "url": "https://example.com"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Navigation completed"
      }
    ],
    "isError": false
  }
}
```

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "activeSessions": 3
}
```

#### GET /
Service information endpoint.

**Response:**
```json
{
  "name": "Playwright MCP HTTP Server",
  "version": "1.0.0",
  "protocol": "MCP v0.1",
  "endpoints": {
    "mcp": "/mcp",
    "health": "/health"
  }
}
```

### 6.2 MCP Protocol Methods

All standard MCP methods must be supported:
- `initialize` - Initialize connection
- `initialized` - Confirm initialization
- `tools/list` - List available tools
- `tools/call` - Invoke a tool
- `notifications/*` - Handle notifications

### 6.3 Tool Parameters

All Playwright MCP tools must accept their documented parameters. See official Playwright MCP documentation for full tool schemas.

---

## 7. Implementation Details

### 7.1 Project Structure

```
playwright-mcp-http-server/
├── src/
│   ├── server.ts              # HTTP server setup
│   ├── mcp-handler.ts         # MCP protocol handler
│   ├── playwright-process.ts  # Playwright process management
│   ├── session-manager.ts     # Session management
│   ├── config.ts              # Configuration
│   └── types/
│       └── mcp.ts             # TypeScript types
├── package.json
├── tsconfig.json
├── Dockerfile
├── .dockerignore
├── README.md
└── .env.example
```

### 7.2 Key Implementation Notes

#### 7.2.1 Playwright Process Management
- Use `child_process.spawn()` to launch `npx @playwright/mcp@latest`
- Communicate via stdin/stdout with JSON-RPC messages
- Handle process lifecycle (start, restart, cleanup)
- Manage multiple concurrent processes if needed

#### 7.2.2 Session Handling
- Option 1: Single shared session (simplest)
- Option 2: Per-request sessions (best isolation)
- Option 3: Named sessions with session IDs (advanced)

**Recommendation**: Start with Option 1 (single shared session) for simplicity, add session management later if needed.

#### 7.2.3 Error Handling
- Catch and format Playwright errors
- Handle process crashes gracefully
- Return proper JSON-RPC error responses
- Log errors for debugging

#### 7.2.4 Configuration
Required environment variables:
- `PORT` - HTTP server port (default: 8931)
- `PLAYWRIGHT_BROWSER` - Browser type (default: chromium)
- `PLAYWRIGHT_HEADLESS` - Headless mode (default: true)
- `LOG_LEVEL` - Logging level (default: info)

Optional:
- `MAX_SESSIONS` - Maximum concurrent sessions
- `SESSION_TIMEOUT` - Session timeout in seconds
- `CORS_ORIGIN` - CORS allowed origins

### 7.3 Dependencies

**Required:**
```json
{
  "dependencies": {
    "@playwright/mcp": "latest",
    "express": "^4.18.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0"
  }
}
```

---

## 8. Deployment Requirements

### 8.1 Deployment Platforms

Must support deployment on:
- **Railway** (primary target)
- **Render**
- **Fly.io**
- **Docker** (any container platform)
- **Traditional VPS/server**

### 8.2 Docker Support

Must include:
- `Dockerfile` based on Node.js image
- `.dockerignore` file
- Multi-stage build (optional optimization)
- Health check configuration

### 8.3 Platform-Specific Configuration

#### Railway
- Use `$PORT` environment variable
- Start command: `npm start`
- Auto-detects Node.js

#### Render
- Use `$PORT` environment variable
- Start command: `npm start`
- Build command: `npm install && npm run build`

#### Docker
- Expose port 8931 (or configurable)
- Health check endpoint at `/health`
- Graceful shutdown on SIGTERM

### 8.4 Health Checks

- Implement `/health` endpoint
- Return 200 OK when service is ready
- Return 503 when service is not ready (starting up, shutting down)

---

## 9. Testing Requirements

### 9.1 Unit Tests
- Test MCP protocol message parsing
- Test error handling
- Test configuration loading
- Target: 80% code coverage

### 9.2 Integration Tests
- Test HTTP endpoint responses
- Test Playwright tool invocations
- Test session management
- Test error scenarios

### 9.3 Manual Testing Checklist
- [ ] Service starts successfully
- [ ] Health endpoint returns 200
- [ ] Can navigate to a URL
- [ ] Can take a screenshot
- [ ] Can click elements
- [ ] Can fill forms
- [ ] Handles invalid requests gracefully
- [ ] Recovers from browser crashes
- [ ] Shuts down gracefully

### 9.4 Performance Testing
- Load test with 10 concurrent requests
- Measure latency for each tool
- Verify no memory leaks
- Test under sustained load (5 minutes)

---

## 10. Documentation Requirements

### 10.1 README.md
Must include:
- Project description
- Quick start guide
- Installation instructions
- Configuration options
- Deployment guide
- API documentation
- Example usage
- Troubleshooting

### 10.2 Code Documentation
- JSDoc comments for all public functions
- TypeScript types for all interfaces
- Inline comments for complex logic

### 10.3 Deployment Documentation
- Railway deployment guide
- Render deployment guide
- Docker deployment guide
- Environment variables reference

---

## 11. Acceptance Criteria

### Must Have (MVP)
- [ ] Service exposes HTTP endpoint for MCP protocol
- [ ] Supports all core Playwright tools (navigate, screenshot, click, type)
- [ ] Works with MCP Registry backend
- [ ] Can be deployed to Railway
- [ ] Health check endpoint works
- [ ] Handles errors gracefully
- [ ] Basic documentation

### Should Have
- [ ] Session management
- [ ] Performance optimization
- [ ] Comprehensive error handling
- [ ] Logging and monitoring
- [ ] Docker support
- [ ] Unit tests

### Nice to Have
- [ ] Multiple concurrent sessions
- [ ] Metrics endpoint
- [ ] Rate limiting
- [ ] Request validation middleware
- [ ] CI/CD pipeline
- [ ] Integration tests

---

## 12. Timeline & Milestones

### Phase 1: Core Implementation (Week 1)
- [ ] Set up project structure
- [ ] Implement HTTP server with Express
- [ ] Integrate `@playwright/mcp` via STDIO
- [ ] Implement basic MCP protocol handler
- [ ] Support `initialize`, `tools/list`, `tools/call`

### Phase 2: Tool Support (Week 1-2)
- [ ] Implement all Playwright tools
- [ ] Test each tool individually
- [ ] Handle tool-specific errors

### Phase 3: Production Ready (Week 2)
- [ ] Add health check endpoint
- [ ] Implement graceful shutdown
- [ ] Add error handling and logging
- [ ] Create Dockerfile
- [ ] Write documentation

### Phase 4: Testing & Deployment (Week 2-3)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Deploy to Railway
- [ ] Test with MCP Registry backend
- [ ] Performance testing

---

## 13. Risks & Mitigations

### Risk 1: Playwright process crashes
**Mitigation**: Implement process monitoring and auto-restart

### Risk 2: High memory usage
**Mitigation**: Limit concurrent sessions, implement session cleanup

### Risk 3: STDIO communication complexity
**Mitigation**: Use well-tested libraries, implement robust error handling

### Risk 4: Deployment platform compatibility
**Mitigation**: Test on multiple platforms early, use Docker as fallback

---

## 14. Success Criteria

The project is successful when:
1. ✅ Service can be deployed to Railway with zero configuration
2. ✅ MCP Registry backend can successfully invoke Playwright tools via HTTP
3. ✅ All core browser operations work correctly
4. ✅ Service handles 10+ concurrent requests without errors
5. ✅ Average response time < 2 seconds for screenshot operations
6. ✅ Service uptime > 99.5% over 1 week period

---

## 15. References

- [Playwright MCP GitHub](https://github.com/microsoft/playwright-mcp)
- [MCP Specification](https://modelcontextprotocol.io)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [Playwright Documentation](https://playwright.dev)

---

## 16. Appendix: Example Implementation

### Minimal Implementation Structure

```typescript
// src/server.ts
import express from 'express';
import { mcpHandler } from './mcp-handler';

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  const result = await mcpHandler.handle(req.body);
  res.json(result);
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 8931;
app.listen(PORT, () => {
  console.log(`Playwright MCP HTTP Server running on port ${PORT}`);
});
```

```typescript
// src/mcp-handler.ts
import { spawn } from 'child_process';

export class MCPHandler {
  private playwrightProcess: any;

  async handle(message: any) {
    // Spawn Playwright process if needed
    if (!this.playwrightProcess) {
      this.playwrightProcess = spawn('npx', ['-y', '@playwright/mcp@latest']);
    }

    // Send message via stdin
    // Receive response via stdout
    // Return formatted response
  }
}
```

---

**Document Status:** Ready for Implementation  
**Next Steps:** Review PRD, create GitHub repository, begin Phase 1 implementation
