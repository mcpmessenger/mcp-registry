# 🌐 SlashMCP.com: The Agentic Hub

**The fastest way to discover and connect Model Context Protocol (MCP) servers.**

[Quick Start](#-quick-start-the-google-era-update) • [Ecosystem Architecture](#️-ecosystem-architecture) • [The Stack](#️-the-stack)

A comprehensive registry and management platform for Model Context Protocol (MCP) services. This monorepo contains both the frontend and backend applications for discovering, managing, and interacting with MCP agents and services.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Technology Stack](#technology-stack)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

SlashMCP.com is a platform designed to help developers discover, register, and manage Model Context Protocol services. It provides a user-friendly interface for browsing available MCP agents, viewing their details, and managing service registrations.

## ✨ Features

### Core Functionality
- **Service Registry**: Register and manage MCP services with metadata
- **Search & Filter**: Find services by name, endpoint, or status
- **Service Management**: Create, update, and delete service entries
- **Service Details**: View comprehensive information about each service
- **One-Click Installation**: Install STDIO servers directly to Cursor or Claude Desktop with a single click
- **Chat Interface**: Interact with MCP agents through a chat interface (default landing page)
- **Voice Transcription**: Real-time voice-to-text using OpenAI Whisper API
- **Document Analysis**: AI-powered analysis of PDFs, images, and text files using Google Gemini Vision
- **Screen Capture**: Capture and analyze screen content using browser APIs
- **Image Generation**: Generate images from natural language using Nano Banana MCP (Gemini-powered)
- **Image Display**: View generated images directly in chat with automatic blob URL conversion
- **STDIO Server Support**: Full support for STDIO-based MCP servers (like Nano Banana MCP)
- **HTTP Server Support**: Support for HTTP-based MCP servers with custom headers
- **Kafka Orchestrator**: Intelligent tool routing that bypasses Gemini for high-signal queries
- **Auto Tool Discovery**: Automatic tool discovery for STDIO servers on registration
- **Real-time Progress**: Server-Sent Events (SSE) for live job progress updates
- **Multi-Tier Fallback**: Robust API fallback strategy for reliable AI generation
- **Modern UI**: Built with Next.js and Tailwind CSS for a responsive experience

### 🆕 Latest Upgrades (December 2024)

#### Kafka-First Orchestrator (NEW - December 2024)
- **Intelligent Tool Routing**: Automatically routes high-signal queries (like "when is the next concert") directly to appropriate MCP tools without invoking Gemini
- **Gemini Quota Protection**: Bypasses Gemini API for deterministic queries, saving quota for complex reasoning tasks
- **Fast-Path Matching**: Keyword and semantic matching routes queries to tools in <50ms
- **Asynchronous Processing**: Kafka-based event-driven architecture for scalable orchestration
- **SSE Support**: Handles Server-Sent Events (SSE) responses from MCP servers like Exa
- **Shared Result Consumer**: Always-ready consumer eliminates timeout issues
- **Status Endpoint**: Check orchestrator health via `/api/orchestrator/status`

**How it works:**
1. User query enters via `/api/orchestrator/query`
2. Ingress Gateway normalizes and publishes to `user-requests` topic
3. MCP Matcher performs fast keyword/semantic matching
4. Execution Coordinator invokes the matched tool
5. Results published to `orchestrator-results` and returned to client

**Setup:**
```bash
# Start Kafka (Docker)
docker-compose -f docker-compose.kafka.yml up -d

# Create topics
.\scripts\setup-kafka-topics.ps1

# Enable in backend .env
ENABLE_KAFKA=true
KAFKA_BROKERS=localhost:9092
```

See [Kafka Setup Guide](docs/KAFKA_SETUP.md) and [Orchestrator Architecture](docs/KAFKA_ORCHESTRATOR.md) for details.

#### One-Click Installation
- **Cursor Deep-Link Support**: Install STDIO servers directly to Cursor with automatic deep-link navigation
- **Claude Desktop Clipboard**: One-click copy-to-clipboard for Claude Desktop configuration
- **Smart Client Detection**: Automatically disables one-click options for HTTP servers (which require manual setup)
- **Permissions Preview**: View server capabilities and permissions before installation
- **Streamlined UX**: Bypasses generic dialog for supported clients, providing instant installation

#### Image Generation with Nano Banana MCP
- **Gemini-Powered Image Generation**: Full integration with Nano Banana MCP for AI image generation
- **Synchronous & Asynchronous Support**: Handles both immediate results and async job polling
- **Base64 to Blob Conversion**: Automatic conversion of large base64 images to blob URLs (fixes 414 errors)
- **Image Display in Chat**: Generated images display directly in the chat interface
- **API Key Management**: Easy API key configuration via UI or API
- **Quota Error Handling**: User-friendly error messages for API quota issues
  - New: Heuristic guard prevents accidental image generation unless explicitly requested or overridden (backend route `POST /api/mcp/tools/generate`).

#### STDIO Server Support
- **Full STDIO Protocol**: Complete support for STDIO-based MCP servers using JSON-RPC
- **Automatic Tool Discovery**: Tools are automatically discovered when STDIO servers are registered
- **On-Demand Discovery**: Tool discovery happens on-demand if tools aren't pre-registered
- **Background Discovery**: Tool discovery continues in background if initial discovery times out
- **Environment Variable Passing**: Secure environment variable injection for STDIO processes
- **State Machine**: Robust state management for STDIO communication (INITIALIZING → INITIALIZED → CALLING → COMPLETE)

#### Server Identity Verification (SEP-1302)
- **Dynamic Identity Provider**: Registry now supports the `/.well-known/mcp-server-identity` standard
- **Automatic Verification**: When a server is published, the registry automatically pings the identity endpoint to verify ownership
- **Cryptographic Signatures**: Verifies signed metadata from server identity endpoints
- **Identity Status**: Tracks verification status and metadata for each registered server

#### Task Management Dashboard (SEP-1686)
- **Durable Request Tracking**: Monitor long-running async operations across MCP servers
- **Task Dashboard**: New `/tasks` route provides real-time monitoring of all durable tasks
- **Status Monitoring**: Track task progress, completion status, and errors
- **Auto-refresh**: Real-time updates with configurable auto-refresh capability
- **Task Filtering**: Filter tasks by server, status, or type
- **Security Scores Overview**: View trust scores for all registered servers

#### Trust Scoring Engine
- **Security Scanning**: Background worker that analyzes registered servers for security issues
- **npm Audit Integration**: Scans dependencies for known vulnerabilities (infrastructure ready)
- **LLM-based Code Analysis**: AI-powered code scanning for security best practices (infrastructure ready)
- **Security Scores**: 0-100 scoring system for each server
- **Scan Results**: Detailed security analysis results stored and accessible via API
- **Periodic Scanning**: Automated security scans for all active servers

### API Endpoints

#### New Endpoints
- `GET /api/tasks` - List all durable tasks
- `GET /api/tasks/:id` - Get specific task details
- `GET /api/tasks/server/:serverId` - Get tasks for a server
- `POST /api/tasks` - Create a new durable task
- `PATCH /api/tasks/:taskId/progress` - Update task progress
- `POST /api/security/scan/:serverId` - Trigger security scan
- `GET /api/security/scores` - Get all security scores
- `GET /api/security/score/:serverId` - Get security score for a server

#### Orchestrator Endpoints
- `POST /api/orchestrator/query` - Submit a query to the intelligent orchestrator
- `GET /api/orchestrator/status` - Check orchestrator health and service status

## 📁 Repository Structure

```
mcp-registry/
├── app/                    # Frontend Next.js application
│   ├── chat/              # Chat interface pages
│   ├── settings/          # Settings pages
│   └── page.tsx           # Main registry page
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   └── ...               # Feature components
├── backend/              # Backend Express API
│   ├── src/             # Backend source code
│   │   └── server.ts    # Express server
│   ├── prisma/          # Prisma schema and migrations
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── package.json     # Backend dependencies
├── types/               # TypeScript type definitions
├── lib/                 # Utility functions and helpers
├── public/              # Static assets
└── README.md            # This file
```

## ⚡ Quick Start

### 1. Generate Images with Nano Banana MCP

**Via Registry UI (Recommended)**
1. Start the backend and frontend (see [Development Setup](#development-setup) below)
2. Navigate to the Registry UI at `http://localhost:3000/registry`
3. Find "Nano Banana MCP" or add it:
   - **Server Type**: STDIO Server
   - **Command**: `npx`
   - **Arguments**: `["-y", "nano-banana-mcp"]`
   - **Credentials**: Your Gemini API key (starts with `AIza...`)
4. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
5. Save and start chatting!

**Try it in Chat:**
- Go to the Chat page
- Select "Nano Banana MCP" from the agent dropdown
- Type: "make me a picture of a kitty"
- The image will appear directly in the chat!

### 2. Add Official Google Maps (Grounding Lite)

**Via Registry UI:**
1. Navigate to the Registry UI at `http://localhost:3000/registry`
2. Find "Google Maps MCP (Grounding Lite)" and click Edit
3. In **HTTP Headers (JSON)**, set: `{"X-Goog-Api-Key":"YOUR_API_KEY_HERE"}`
4. Enable **Maps Grounding Lite API** in your Google Cloud Console
5. Save and start chatting!

**For Cline or Claude Desktop:**
```json
"google-maps": {
  "command": "npx",
  "args": ["-y", "@googlemaps/code-assist-mcp@latest"],
  "env": {
    "GOOGLE_MAPS_API_KEY": "YOUR_API_KEY_HERE"
  }
}
```

### 3. Enable Kafka Orchestrator (Recommended)

The orchestrator intelligently routes queries to the right tools without using Gemini quota:

1. **Start Kafka:**
   ```powershell
   docker-compose -f docker-compose.kafka.yml up -d
   .\scripts\setup-kafka-topics.ps1
   ```

2. **Enable in backend `.env`:**
   ```env
   ENABLE_KAFKA=true
   KAFKA_BROKERS=localhost:9092
   ```

3. **Restart backend** - You'll see:
   - `[Server] ✓ MCP Matcher started successfully`
   - `[Server] ✓ Execution Coordinator started successfully`
   - `[Server] ✓ Result Consumer started successfully`

4. **Test it:**
   - Go to Chat page
   - Select "Auto-Route (Recommended)"
   - Ask: "when is the next iration concert in texas"
   - Should route directly to Exa without Gemini!

**Check status:**
```bash
curl http://localhost:3001/api/orchestrator/status
```

### 4. Add the Playwright Registry Bridge

To browse the web and interact with maps via a real browser:

```bash
npx @mcpmessenger/playwright-mcp --install
```

### Development Setup

**Prereqs**
- Node.js ≥ 18
- PostgreSQL (or SQLite for dev)
- npm for backend; pnpm (or npm) for frontend

**Backend (API at http://localhost:3001)**
```bash
cd backend
npm install
cp env.example.txt .env   # edit secrets/DB
npm run migrate
npm run seed   # seeds all stock servers (Playwright, LangChain, Google Maps MCP, Valuation)
npm start
```

**Frontend (http://localhost:3000)**
```bash
# From project root:
pnpm install
NEXT_PUBLIC_API_URL=http://localhost:3001 pnpm dev
```

**Note:** The `.env.local` file is automatically created with `NEXT_PUBLIC_API_URL=http://localhost:3001` for local development.

**Common env (backend)**
```env
DATABASE_URL=postgresql://mcp_registry:your_secure_password@localhost:5432/mcp_registry
PORT=3001
CORS_ORIGIN=http://localhost:3000
GOOGLE_GEMINI_API_KEY=
OPENAI_API_KEY=

# Kafka Orchestrator (optional but recommended)
ENABLE_KAFKA=true
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=mcp-orchestrator-coordinator
KAFKA_GROUP_ID=mcp-orchestrator-coordinator
```

## 🏗️ Ecosystem Architecture

The registry orchestrates between your local machine and Google's cloud-scale tools.

```mermaid
graph LR
    User([User]) --> Agent[Cline / Claude]
    Agent --> Registry{Registry}
    
    subgraph "Managed (Official)"
        Registry --> GMaps[Google Maps Grounding]
        Registry --> BQ[BigQuery MCP]
    end
    
    subgraph "Local / Hybrid"
        Registry --> PW[Playwright-MCP]
        Registry --> LC[LangchainMCP]
    end
    
    GMaps --- Tool1[Search & Routes]
    PW --- Tool2[Browser Automation]
```

## 🗺️ New: Google Maps MCP Integration

The registry now supports both managed and automated map tools:

- **Google Grounding Lite**: Access fresh, official geospatial data, real-time weather, and distance matrices. No hallucinations—just raw Google Maps data.
- **Playwright-MCP Bridge**: Need to actually see the map or scrape specific business details? Use the Playwright bridge to automate the Google Maps UI.

## 🔀 Workflow at a Glance

```mermaid
graph TD
  A[Chat UI] -->|/v0.1/servers| B[Registry Backend]
  A -->|/v0.1/invoke| B
  B -->|routes to| C[MCP Servers (HTTP/STDIO)]
  C -->|tools/call result| B --> A
```

Notes:
- HTTP MCPs can require headers (e.g., Google Maps MCP needs `X-Goog-Api-Key` in the agent's HTTP Headers).
- STDIO MCPs (Playwright, LangChain) are spawned by the backend.
- Registry seeds include Playwright, LangChain, and Google Maps MCP; add your own via the Registry UI or publish API.

### API Endpoints

The backend provides the following key endpoints:

- **Registry API** (MCP v0.1 specification):
  - `GET /v0.1/servers` - List all registered MCP servers (supports `?search=` and `?capability=` query parameters)
  - `GET /v0.1/servers/:serverId` - Get a specific server by ID
  - `POST /v0.1/publish` - Register a new MCP server
  - `PUT /v0.1/servers/:serverId` - Update an existing server
  - `DELETE /v0.1/servers/:serverId` - Delete a server
  - `POST /v0.1/invoke` - Invoke an MCP tool via backend proxy

- **Audio Transcription**:
  - `POST /api/audio/transcribe` - Transcribe audio files using Whisper

- **Document Analysis**:
  - `POST /api/documents/analyze` - Analyze documents (PDFs, images, text) using Gemini Vision

- **Streaming & WebSocket**:
  - `GET /api/streams/jobs/:jobId` - Get job status via SSE
  - `ws://localhost:3001/ws` - WebSocket for real-time updates

### Event-Driven Architecture Components

- **Kafka**: A local Kafka broker powers both the async design pipeline and the intelligent orchestrator. Start it with `docker compose -f docker-compose.kafka.yml up -d`, which spins up Zookeeper and Kafka. Shut it down with `docker compose -f docker-compose.kafka.yml down`.
- **Orchestrator Topics**: 
  - `user-requests`: Normalized user queries from the Ingress Gateway
  - `tool-signals`: High-confidence tool matches from the MCP Matcher
  - `orchestrator-plans`: Gemini fallback plans (when matcher can't resolve)
  - `orchestrator-results`: Final tool execution results
- **Design Pipeline Topics**: `design-requests` receives `DESIGN_REQUEST_RECEIVED` events; `design-ready` carries `DESIGN_READY`/`DESIGN_FAILED` results.
- **Orchestrator Flow**: 
  1. Frontend calls `POST /api/orchestrator/query` with user query
  2. Ingress Gateway normalizes query and publishes to `user-requests`
  3. MCP Matcher performs fast keyword/semantic matching (<50ms)
  4. Execution Coordinator invokes matched tool and publishes result
  5. Query route receives result via shared result consumer
  6. Response returned to frontend
- **Backend Flow**: `POST /api/mcp/tools/generate` queues a request (publishes `DESIGN_REQUEST_RECEIVED`), a multimodal worker consumes it, and the backend pushes progress/completions through its WebSocket (`ws://localhost:3001/ws`).
- **WebSocket Testing**: You can watch jobs with `npx wscat -c ws://localhost:3001/ws` and send `{ "type": "subscribe", "jobId": "<id>" }` to receive `job_status` updates and the resulting SVG payload.

By wiring Kafka to the Prisma-backed backend we now preserve a responsive frontend while heavy LLM work happens asynchronously in the background, and intelligent routing bypasses Gemini for high-signal queries.

### Database & Memory

The backend now ships with PostgreSQL (recommended for production) plus a Prisma `Memory` model that persists conversation history, tool invocations, and memories. The `memory.service.ts` exposes helpers such as `searchHistory`, `storeMemory`, and `getMemories`, while the `invoke` endpoint exposes a `search_history` tool so agents can look up relevant context before responding. Keep your Postgres container running (or point `DATABASE_URL` at a managed instance) to retain agent state between restarts.

Prisma automatically maintains migration history in `backend/prisma/migrations`; rerun `npx prisma migrate dev` whenever you change the schema.

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[Development Guide](docs/DEVELOPMENT.md)** - Complete setup and development workflow
- **[API Documentation](docs/API.md)** - Complete API reference
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Event-Driven Architecture](docs/EVENT_DRIVEN_ARCHITECTURE.md)** - Kafka and event processing
- **[Kafka Setup Guide](docs/KAFKA_SETUP.md)** - How to set up Kafka locally
- **[Kafka Orchestrator](docs/KAFKA_ORCHESTRATOR.md)** - Orchestrator architecture and implementation
- **[Testing Guide](docs/TESTING_ONE_CLICK_INSTALL.md)** - One-click installation feature testing
- **[Strategic Roadmap](docs/STRATEGIC_ROADMAP.md)** - Long-term vision and strategy

## 💻 Development

Both frontend and backend can be developed independently:

- **Frontend**: Runs on port 3000 (default Next.js port)
- **Backend**: Runs on port 3001 (configurable via environment variables)

See the [Development Guide](docs/DEVELOPMENT.md) for detailed instructions.

## 🚢 Deployment

For production deployment, see the [Deployment Guide](docs/DEPLOYMENT.md).

**Quick Summary:**
- **Frontend**: Deploy to Vercel (auto-deploys on push to main)
- **Backend**: Deploy to GCP Cloud Run using Artifact Registry
- **Database**: Cloud SQL (PostgreSQL) or SQLite for development
- **Event Bus**: Confluent Cloud (Kafka) or Cloud Pub/Sub (optional)

**Backend Deployment (Cloud Run):**
```bash
cd backend
cp Dockerfile.debian Dockerfile
gcloud builds submit --tag us-central1-docker.pkg.dev/PROJECT_ID/mcp-registry/mcp-registry-backend --region us-central1 .
gcloud run deploy mcp-registry-backend \
  --image us-central1-docker.pkg.dev/PROJECT_ID/mcp-registry/mcp-registry-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
rm Dockerfile
```

**Frontend Deployment (Vercel):**
- Auto-deploys on push to main branch
- Or manually: `vercel --prod`

## 🛠️ The Stack

- **mcp-registry**: Central discovery for all official and community servers.
- **playwright-mcp**: Full browser capabilities (Chromium) for your agent.
- **LangchainMCP**: Bridging MCP tools into production LangGraph/LangChain workflows.

### Technology Stack

**Frontend**
- **Next.js 16** - React framework
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible component primitives
- **shadcn/ui** - UI component library

**Backend**
- **Express.js 5** - Web framework
- **Prisma** - ORM and database toolkit
- **TypeScript** - Type safety
- **PostgreSQL** - Database (production), SQLite (development)
- **Google Gemini API** - AI-powered SVG generation and document analysis
- **Google Vision API** - Image analysis capabilities
- **OpenAI Whisper API** - Voice-to-text transcription
- **Apache Kafka** - Event-driven architecture for async processing and intelligent orchestration
- **Server-Sent Events (SSE)** - Real-time progress streaming
- **WebSocket** - Bidirectional communication
- **ts-node** - TypeScript execution
- **Multer** - File upload handling

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🎨 Image Generation Example

Here's how to use the image generation feature:

1. **Register Nano Banana MCP** (if not already registered):
   - Server Type: STDIO Server
   - Command: `npx`
   - Arguments: `["-y", "nano-banana-mcp"]`
   - Credentials: Your Gemini API key

2. **Generate an Image**:
   - Go to Chat page
   - Select "Nano Banana MCP" or use "Auto-Route"
   - Type: "make me a picture of a kitty"
   - Wait a few seconds...
   - Image appears in chat! 🎉

3. **Features**:
   - Works with both HTTP and STDIO MCP servers
   - Automatic tool discovery
   - Handles large images (converts base64 to blob URLs)
   - Shows quota errors with helpful messages
   - Supports both synchronous and asynchronous generation

## 🔧 Troubleshooting

### Image Not Displaying
- Check browser console for errors
- Verify API key is set correctly in registry
- Ensure billing is enabled for Gemini API (free tier has limited quotas)
- Check network tab for 414 errors (should be fixed with blob URL conversion)

### API Key Issues
- Get a new key from [Google AI Studio](https://aistudio.google.com/apikey)
- Keys must start with `AIza...`
- Update via Registry UI or API
- See [docs/HOW_TO_GET_GEMINI_API_KEY.md](docs/HOW_TO_GET_GEMINI_API_KEY.md) for details

### One-Click Installation Not Working
- **HTTP servers**: One-click installation only works for STDIO servers (with commands). HTTP servers require manual configuration via the generic install dialog.
- **Missing command**: Ensure the server has a `command` field configured (e.g., `npx`, `node`, `python`)
- **Cursor not opening**: Verify Cursor is installed and the browser allows deep-link navigation
- **Clipboard not working**: Ensure you're testing on `http://localhost` (clipboard API requires secure context)

### STDIO Server Not Working
- Verify command and arguments are correct
- Check environment variables are set
- Look at backend logs for initialization errors
- Ensure `npx` is available in the container

### Orchestrator Not Working
- **Check Kafka is running**: `docker ps` should show `zookeeper` and `kafka` containers
- **Verify topics exist**: Run `.\scripts\setup-kafka-topics.ps1` if topics are missing
- **Check backend logs**: Look for `[Server] ✓ MCP Matcher started successfully` and `[Server] ✓ Execution Coordinator started successfully`
- **Verify environment variables**: Ensure `ENABLE_KAFKA=true` and `KAFKA_BROKERS=localhost:9092` in `backend/.env`
- **Check status endpoint**: `curl http://localhost:3001/api/orchestrator/status` should show all services as `true`
- **Timeout issues**: If queries timeout, check that Result Consumer is running (should see `[Server] ✓ Result Consumer started successfully`)
- **SSE parsing errors**: Make sure backend has been restarted after the SSE parsing fix was applied

## 📞 Support

For issues, questions, or contributions, please open an issue on the [GitHub repository](https://github.com/mcpmessenger/mcp-registry).

---

Built with ❤️ for the MCP community
