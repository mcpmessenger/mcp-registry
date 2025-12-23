# MCP Registry

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

The MCP Registry is a platform designed to help developers discover, register, and manage Model Context Protocol services. It provides a user-friendly interface for browsing available MCP agents, viewing their details, and managing service registrations.

## ✨ Features

### Core Functionality
- **Service Registry**: Register and manage MCP services with metadata
- **Search & Filter**: Find services by name, endpoint, or status
- **Service Management**: Create, update, and delete service entries
- **Service Details**: View comprehensive information about each service
- **Chat Interface**: Interact with MCP agents through a chat interface (default landing page)
- **Voice Transcription**: Real-time voice-to-text using OpenAI Whisper API
- **Document Analysis**: AI-powered analysis of PDFs, images, and text files using Google Gemini Vision
- **Screen Capture**: Capture and analyze screen content using browser APIs
- **SVG Generation**: Generate SVG graphics from natural language descriptions using Google Gemini AI
- **Visual SVG Rendering**: View generated SVGs directly in the chat with code toggle
- **Real-time Progress**: Server-Sent Events (SSE) for live job progress updates
- **Multi-Tier Fallback**: Robust API fallback strategy for reliable AI generation
- **Modern UI**: Built with Next.js and Tailwind CSS for a responsive experience

### 🆕 Latest Upgrades (December 2024)

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

## 🚀 Quick Start (snappy)

For full details, see [Development Guide](docs/DEVELOPMENT.md). Below is the shortest path to a working local stack.

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
npx ts-node src/scripts/register-official-servers.ts   # seeds Playwright, LangChain, Google Maps MCP
npm start
```

**Frontend (http://localhost:3000)**
```bash
cd mcp-registry-main
pnpm install
NEXT_PUBLIC_API_URL=http://localhost:3001 pnpm dev
```

**Google Maps MCP (Grounding Lite)**
- In Registry UI, edit the “Google Maps MCP” agent, set HTTP Headers (JSON) to `{"X-Goog-Api-Key":"YOUR_KEY"}`.
- Enable Maps Grounding Lite API on your GCP project.

**Common env (backend)**
```env
DATABASE_URL=postgresql://mcp_registry:your_secure_password@localhost:5432/mcp_registry
PORT=3001
CORS_ORIGIN=http://localhost:3000
GOOGLE_GEMINI_API_KEY=
OPENAI_API_KEY=
```

## 🔀 Workflow at a Glance

```mermaid
graph TD
  A[Chat UI] -->|/v0.1/servers| B[Registry Backend]
  A -->|/v0.1/invoke| B
  B -->|routes to| C[MCP Servers (HTTP/STDIO)]
  C -->|tools/call result| B --> A
```

Notes:
- HTTP MCPs can require headers (e.g., Google Maps MCP needs `X-Goog-Api-Key` in the agent’s HTTP Headers).
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

- **Kafka**: A local Kafka broker powers the async design pipeline. Start it with `docker compose -f docker-compose.kafka.yml up -d`, which spins up Zookeeper and Kafka via the provided compose file. Shut it down with `docker compose -f docker-compose.kafka.yml down`.
- **Topics**: `design-requests` receives `DESIGN_REQUEST_RECEIVED` events; `design-ready` carries `DESIGN_READY`/`DESIGN_FAILED` results. The backend consumes both topics internally.
- **Backend Flow**: `POST /api/mcp/tools/generate` queues a request (publishes `DESIGN_REQUEST_RECEIVED`), a multimodal worker consumes it, and the backend pushes progress/completions through its WebSocket (`ws://localhost:3001/ws`).
- **WebSocket Testing**: You can watch jobs with `npx wscat -c ws://localhost:3001/ws` and send `{ "type": "subscribe", "jobId": "<id>" }` to receive `job_status` updates and the resulting SVG payload.

By wiring Kafka to the Prisma-backed backend we now preserve a responsive frontend while heavy LLM work happens asynchronously in the background.

### Database & Memory

The backend now ships with PostgreSQL (recommended for production) plus a Prisma `Memory` model that persists conversation history, tool invocations, and memories. The `memory.service.ts` exposes helpers such as `searchHistory`, `storeMemory`, and `getMemories`, while the `invoke` endpoint exposes a `search_history` tool so agents can look up relevant context before responding. Keep your Postgres container running (or point `DATABASE_URL` at a managed instance) to retain agent state between restarts.

Prisma automatically maintains migration history in `backend/prisma/migrations`; rerun `npx prisma migrate dev` whenever you change the schema.

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[Development Guide](docs/DEVELOPMENT.md)** - Complete setup and development workflow
- **[API Documentation](docs/API.md)** - Complete API reference
- **[Architecture Documentation](docs/ARCHITECTURE.md)** - System architecture overview
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Event-Driven Architecture](docs/EVENT_DRIVEN_ARCHITECTURE.md)** - Kafka and event processing
- **[Kafka Setup](docs/KAFKA_SETUP.md)** - Kafka configuration and setup

## 💻 Development

Both frontend and backend can be developed independently:

- **Frontend**: Runs on port 3000 (default Next.js port)
- **Backend**: Runs on port 3001 (configurable via environment variables)

See the [Development Guide](docs/DEVELOPMENT.md) for detailed instructions.

## 🚢 Deployment

For production deployment, see the [Deployment Guide](docs/DEPLOYMENT.md).

**Quick Summary:**
- **Frontend**: Deploy to Vercel (already configured)
- **Backend**: Deploy to GCP Cloud Run (recommended)
- **Database**: Cloud SQL (PostgreSQL)
- **Event Bus**: Confluent Cloud (Kafka) or Cloud Pub/Sub

## 🛠 Technology Stack

### Frontend
- **Next.js 16** - React framework
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible component primitives
- **shadcn/ui** - UI component library

### Backend
- **Express.js 5** - Web framework
- **Prisma** - ORM and database toolkit
- **TypeScript** - Type safety
- **PostgreSQL** - Database (production), SQLite (development)
- **Google Gemini API** - AI-powered SVG generation and document analysis
- **Google Vision API** - Image analysis capabilities
- **OpenAI Whisper API** - Voice-to-text transcription
- **Apache Kafka** - Event-driven architecture for async processing
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

## 📞 Support

For issues, questions, or contributions, please open an issue on the [GitHub repository](https://github.com/mcpmessenger/mcp-registry).

---

Built with ❤️ for the MCP community
