# MCP Registry Backend

Backend API server for the MCP Registry platform, implementing the Core Registry v0.1 API, MCP Server, and async transport layer.

## Features

- **Core Registry v0.1 API** - `/v0/servers` endpoint for discovering MCP servers
- **MCP Tools Service** - Generate and refine SVGs using Google Gemini with multi-tier fallback strategy
- **Job Tracking** - Persistent job status tracking with progress updates
- **SSE Streaming** - Server-Sent Events for real-time progress updates
- **WebSocket Support** - Bidirectional communication for interactive refinement
- **Prisma ORM** - Type-safe database access with SQLite (dev) and PostgreSQL (prod) support

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Cloud account with Vision API and Gemini API enabled

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the `backend/` directory:
   ```env
   DATABASE_URL="file:./dev.db"
   PORT=3001
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:3000
   GOOGLE_VISION_API_KEY=your_google_vision_api_key_here
   GOOGLE_GEMINI_API_KEY=your_google_gemini_api_key_here
   GEMINI_MODEL_NAME=gemini-1.5-flash-001
   ```

   **Note:** 
   - For Google Vision API, you may need to use service account credentials instead of an API key. Set `GOOGLE_APPLICATION_CREDENTIALS` to the path of your service account JSON file.
   - `GEMINI_MODEL_NAME` is optional. Use specific version tags (e.g., `gemini-1.5-flash-001`) for better compatibility. Default: `gemini-1.5-flash-001`
   - The backend uses a multi-tier fallback strategy: tries new `@google/genai` SDK if available, falls back to REST API v1 endpoint (most reliable), and can retry with alternative models if needed.

3. **Run database migrations:**
   ```bash
   npm run migrate
   ```

4. **Seed the MCP server:**
   ```bash
   npm run seed
   ```

5. **Start the server:**
   ```bash
   npm start
   ```

The server will start on `http://localhost:3001`

## API Endpoints

### Registry API

- `GET /v0/servers` - List all available MCP servers
- `GET /v0/servers/:serverId` - Get a specific server by ID

### MCP Tools API

- `POST /api/mcp/tools/generate` - Generate an SVG
  ```json
  {
    "description": "minimalist icon, blue palette",
    "style": "modern",
    "colorPalette": ["#0066FF", "#FFFFFF"],
    "size": { "width": 512, "height": 512 }
  }
  ```

- `POST /api/mcp/tools/refine` - Refine an existing design
  ```json
  {
    "jobId": "job-id-here",
    "instructions": "make the icon larger"
  }
  ```

- `GET /api/mcp/tools/job/:jobId` - Get job status and result

### Streaming API

- `GET /api/streams/jobs/:jobId` - SSE endpoint for job progress updates

### WebSocket

- `ws://localhost:3001/ws` - WebSocket endpoint for bidirectional communication
  ```json
  {
    "type": "subscribe",
    "jobId": "job-id-here"
  }
  ```

## Database

The backend uses Prisma ORM with:
- **SQLite** for development (default)
- **PostgreSQL** for production

To switch to PostgreSQL, update `DATABASE_URL` in `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/mcp_registry?schema=public"
```

Then update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Run migrations:
```bash
npm run migrate:deploy
```

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration (env, database)
│   ├── integrations/   # External API clients (Google Vision, Gemini)
│   ├── middleware/      # Express middleware (CORS, SSE, error handling)
│   ├── repositories/    # Data access layer
│   ├── routes/          # API route handlers
│   │   ├── v0/         # Registry v0.1 API
│   │   ├── mcp/        # MCP tool endpoints
│   │   └── streams/    # SSE endpoints
│   ├── services/        # Business logic
│   ├── scripts/        # Utility scripts (seed, etc.)
│   ├── types/          # TypeScript type definitions
│   └── server.ts       # Express app entry point
├── prisma/
│   └── schema.prisma   # Database schema
└── package.json
```

## Development

### Running in Development

```bash
npm start
```

The server will reload automatically with `ts-node`.

### Building for Production

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### Database Migrations

Create a new migration:
```bash
npm run migrate
```

Deploy migrations (production):
```bash
npm run migrate:deploy
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | Database connection string | Yes | `file:./dev.db` |
| `PORT` | Server port | No | `3001` |
| `NODE_ENV` | Environment mode | No | `development` |
| `CORS_ORIGIN` | Allowed CORS origin | No | `http://localhost:3000` |
| `GOOGLE_VISION_API_KEY` | Google Vision API key | Yes* | - |
| `GOOGLE_GEMINI_API_KEY` | Google Gemini API key | Yes | - |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON | Yes* | - |

*Either `GOOGLE_VISION_API_KEY` or `GOOGLE_APPLICATION_CREDENTIALS` is required for Vision API.

## License

ISC
