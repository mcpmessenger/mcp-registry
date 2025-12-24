# API Documentation

Complete API reference for the MCP Registry backend.

## Base URL

- **Development**: `http://localhost:3001`
- **Production**: `https://your-backend-domain.com`

## Authentication

Currently, the API does not require authentication for most endpoints. OAuth 2.1 support is implemented but optional.

## Registry API (MCP v0.1 Specification)

### List Servers

Get all registered MCP servers.

**Endpoint**: `GET /v0.1/servers`

**Query Parameters**:
- `search` (optional): Filter by name or description
- `capability` (optional): Filter by capability name

**Example Request**:
```bash
curl "http://localhost:3001/v0.1/servers?search=playwright"
```

**Example Response**:
```json
[
  {
    "serverId": "com.microsoft.playwright/mcp",
    "name": "Playwright MCP Server",
    "description": "Browser automation using Playwright",
    "version": "v0.1",
    "tools": [
      {
        "name": "navigate",
        "description": "Navigate to a URL",
        "inputSchema": { ... }
      }
    ],
    "capabilities": ["tools"]
  }
]
```

### Get Server

Get a specific server by ID.

**Endpoint**: `GET /v0.1/servers/:serverId`

**URL Encoding**: Server IDs containing `/` must be URL-encoded (e.g., `com.microsoft.playwright%2Fmcp`)

**Example Request**:
```bash
curl "http://localhost:3001/v0.1/servers/com.microsoft.playwright%2Fmcp"
```

**Example Response**:
```json
{
  "serverId": "com.microsoft.playwright/mcp",
  "name": "Playwright MCP Server",
  "description": "Browser automation using Playwright",
  "version": "v0.1",
  "command": "node",
  "args": ["server.js"],
  "tools": [ ... ],
  "capabilities": ["tools"]
}
```

### Publish Server

Register a new MCP server.

**Endpoint**: `POST /v0.1/publish`

**Request Body**:
```json
{
  "serverId": "io.github.username/mcp-server",
  "name": "My MCP Server",
  "description": "Description of my server",
  "version": "v0.1",
  "command": "node",
  "args": ["server.js"],
  "env": {
    "API_KEY": "value"
  },
  "tools": [
    {
      "name": "my_tool",
      "description": "Tool description",
      "inputSchema": {
        "type": "object",
        "properties": {
          "param": {
            "type": "string",
            "description": "Parameter description"
          }
        },
        "required": ["param"]
      }
    }
  ],
  "capabilities": ["tools"]
}
```

**Response**: Returns the created server object.

### Update Server

Update an existing server.

**Endpoint**: `PUT /v0.1/servers/:serverId`

**Request Body**: Same as publish, but all fields optional.

### Delete Server

Delete a server.

**Endpoint**: `DELETE /v0.1/servers/:serverId`

**Response**: `204 No Content` on success.

### Invoke Tool

Invoke an MCP tool via backend proxy.

**Endpoint**: `POST /v0.1/invoke`

**Request Body**:
```json
{
  "serverId": "com.microsoft.playwright/mcp",
  "tool": "navigate",
  "arguments": {
    "url": "https://example.com"
  }
}
```

**Response**:
```json
{
  "result": "...",
  "isError": false
}
```

## MCP Tools API

### Generate SVG

Generate an SVG from a natural language description.

**Endpoint**: `POST /api/mcp/tools/generate`

**Request Body**:
```json
{
  "description": "minimalist icon, blue palette",
  "style": "modern",
  "colorPalette": ["#0066FF", "#FFFFFF"],
  "size": {
    "width": 512,
    "height": 512
  }
}
```

**Response**:
```json
{
  "jobId": "clx123abc",
  "status": "PENDING"
}
```

### Refine Design

Refine an existing design.

**Endpoint**: `POST /api/mcp/tools/refine`

**Request Body**:
```json
{
  "jobId": "clx123abc",
  "instructions": "make the icon larger and add more blue"
}
```

### Get Job Status

Get the status and result of a job.

**Endpoint**: `GET /api/mcp/tools/job/:jobId`

**Response**:
```json
{
  "id": "clx123abc",
  "status": "COMPLETED",
  "result": "<svg>...</svg>",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:01:00Z"
}
```

## Streaming API

### Server-Sent Events (SSE)

Get real-time job progress updates.

**Endpoint**: `GET /api/streams/jobs/:jobId`

**Response**: SSE stream with events:
```
event: progress
data: {"status": "PROCESSING", "progress": 50}

event: complete
data: {"status": "COMPLETED", "result": "<svg>...</svg>"}
```

## WebSocket API

**Endpoint**: `ws://localhost:3001/ws`

### Subscribe to Job Updates

Send:
```json
{
  "type": "subscribe",
  "jobId": "clx123abc"
}
```

Receive:
```json
{
  "type": "job_status",
  "jobId": "clx123abc",
  "status": "COMPLETED",
  "result": "<svg>...</svg>"
}
```

## Audio API

### Transcribe Audio

Transcribe audio files using OpenAI Whisper.

**Endpoint**: `POST /api/audio/transcribe`

**Request**: `multipart/form-data` with `audio` file

**Response**:
```json
{
  "text": "Transcribed text here",
  "language": "en"
}
```

## Document Analysis API

### Analyze Document

Analyze PDFs, images, or text files using Google Gemini Vision.

**Endpoint**: `POST /api/documents/analyze`

**Request**: `multipart/form-data` with `file` and optional `prompt`

**Response**:
```json
{
  "analysis": "Document analysis text",
  "summary": "Brief summary",
  "type": "pdf"
}
```

## Health Check

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

**HTTP Status Codes**:
- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

Rate limiting is enforced on certain endpoints. Check response headers:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time

## Examples

### Complete Workflow: Generate SVG

```bash
# 1. Generate SVG
JOB_ID=$(curl -X POST http://localhost:3001/api/mcp/tools/generate \
  -H "Content-Type: application/json" \
  -d '{"description": "minimalist icon, blue palette"}' \
  | jq -r '.jobId')

# 2. Check status
curl "http://localhost:3001/api/mcp/tools/job/$JOB_ID"

# 3. Subscribe via WebSocket (use wscat)
# wscat -c ws://localhost:3001/ws
# {"type": "subscribe", "jobId": "$JOB_ID"}
```

### Register a Server

```bash
curl -X POST http://localhost:3001/v0.1/publish \
  -H "Content-Type: application/json" \
  -d @server-manifest.json
```

## See Also

- [MCP v0.1 Specification](https://modelcontextprotocol.io)
- [Development Guide](./DEVELOPMENT.md)
- [Architecture Documentation](./ARCHITECTURE.md)





