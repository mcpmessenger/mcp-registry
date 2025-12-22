# Architecture Documentation

Complete overview of the MCP Registry platform architecture.

## System Overview

The MCP Registry is a **microservice architecture** built around the Model Context Protocol (MCP), enabling LLMs to discover and interact with external tools and services.

### Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                   │
│              https://mcp-registry.vercel.app            │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP/WebSocket
┌─────────────────────▼───────────────────────────────────┐
│              Backend API (Express.js)                   │
│              MCP Registry + Tools Service               │
│  • Registry API (v0.1)                                  │
│  • Tool Invocation                                      │
│  • Job Management                                       │
└───────┬──────────────────────┬──────────┬───────────────┘
        │                      │          │
        │                      │          │
┌───────▼──────────┐  ┌───────▼──────┐  │
│   PostgreSQL     │  │    Kafka     │  │
│   Database       │  │  Event Bus   │  │
└──────────────────┘  └──────────────┘  │
                                        │
                          ┌─────────────▼─────────────┐
                          │   External MCP Servers    │
                          │  • Playwright MCP         │
                          │  • LangChain MCP          │
                          │  • Custom Servers         │
                          └───────────────────────────┘
```

## Core Components

### 1. Frontend (Next.js)

**Technology**: Next.js 16, React 19, TypeScript, Tailwind CSS

**Responsibilities**:
- User interface for browsing MCP servers
- Chat interface for agent interaction
- Real-time updates via WebSocket/SSE
- File upload and document analysis

**Key Features**:
- Server-side rendering (SSR)
- Real-time progress updates
- Voice transcription
- SVG generation visualization

### 2. Backend API (Express.js)

**Technology**: Express.js 5, TypeScript, Prisma ORM

**Responsibilities**:
- MCP Registry API (v0.1 specification)
- Tool invocation proxy
- Job management and tracking
- Authentication and authorization

**API Endpoints**:
- `/v0.1/servers` - Server discovery
- `/v0.1/publish` - Server registration
- `/v0.1/invoke` - Tool invocation
- `/api/mcp/tools/*` - Tool endpoints
- `/api/streams/*` - SSE streams
- `/ws` - WebSocket endpoint

### 3. Database (PostgreSQL)

**Technology**: PostgreSQL with Prisma ORM

**Schema**:
- `McpServer` - Registered MCP servers
- `Job` - Async job tracking
- `Memory` - Agent conversation history
- `OAuthClient` - OAuth client registry
- `Federation` - Registry federation support

### 4. Event-Driven Architecture (Kafka)

**Technology**: Apache Kafka

**Purpose**: Decouple heavy operations (AI generation) from API responses

**Topics**:
- `design-requests` - Design generation requests
- `design-ready` - Design completion events

**Flow**:
1. API Gateway receives request → Publishes event
2. Worker consumes event → Processes design
3. Worker publishes completion event
4. API Gateway consumer → Updates job → Pushes to frontend

See [Event-Driven Architecture](./EVENT_DRIVEN_ARCHITECTURE.md) for details.

### 5. External Services

#### Google APIs
- **Gemini API**: SVG generation, document analysis
- **Vision API**: Image analysis

#### OpenAI
- **Whisper API**: Voice transcription

#### MCP Servers
- **Playwright MCP**: Browser automation
- **LangChain MCP**: LLM agent workflows

## Data Flow

### Server Registration Flow

```
1. Developer → POST /v0.1/publish
2. Backend validates schema
3. Backend stores in database
4. Backend returns server metadata
```

### Tool Invocation Flow

```
1. Frontend → POST /v0.1/invoke
2. Backend looks up server
3. Backend proxies request to MCP server
4. MCP server processes request
5. Backend returns result to frontend
```

### Async Job Flow (SVG Generation)

```
1. Frontend → POST /api/mcp/tools/generate
2. Backend creates job → Publishes Kafka event
3. Backend returns jobId immediately
4. Worker consumes event → Generates SVG
5. Worker publishes completion event
6. Backend updates job → Pushes to frontend via WebSocket
```

## Security Architecture

### Authentication & Authorization

- **OAuth 2.1**: Client registration and consent management
- **Token Encryption**: OAuth tokens encrypted at rest
- **Federation**: Support for private sub-registries

### Data Protection

- **Input Validation**: Zod schemas for all inputs
- **SQL Injection Prevention**: Prisma ORM with parameterized queries
- **CORS Configuration**: Restrictive CORS policies
- **Rate Limiting**: Per-endpoint rate limiting (implemented in playwright-mcp)

## Scalability Considerations

### Horizontal Scaling

- **Stateless Backend**: Can run multiple instances
- **Database Connection Pooling**: Prisma handles connection pooling
- **Kafka Consumer Groups**: Multiple workers can process events

### Performance Optimization

- **Database Indexing**: Key fields indexed in Prisma schema
- **Async Processing**: Heavy operations moved to Kafka
- **Caching**: Consider Redis for frequently accessed data

## Deployment Architecture

### Development
- Frontend: `localhost:3000` (Next.js dev server)
- Backend: `localhost:3001` (Express with ts-node)
- Database: Local PostgreSQL or SQLite
- Kafka: Docker Compose (optional)

### Production
- Frontend: Vercel (edge deployment)
- Backend: GCP Cloud Run (auto-scaling containers)
- Database: Cloud SQL (managed PostgreSQL)
- Kafka: Confluent Cloud or Cloud Pub/Sub

See [Deployment Guide](./DEPLOYMENT.md) for details.

## Technology Decisions

### Why Next.js?
- Server-side rendering for SEO
- Built-in API routes
- Optimized production builds
- Excellent developer experience

### Why Express.js?
- Mature ecosystem
- Flexible middleware system
- Easy integration with MCP protocol
- Good TypeScript support

### Why Prisma?
- Type-safe database queries
- Migration management
- Multiple database support
- Excellent developer experience

### Why Kafka?
- Decouples heavy operations
- Horizontal scalability
- Event replay capabilities
- Production-ready reliability

## Future Considerations

### Planned Enhancements
- GraphQL API for flexible queries
- gRPC for inter-service communication
- Redis for caching and session management
- Elasticsearch for advanced search

### Migration Paths
- Go services for high-throughput endpoints
- Python workers for AI/ML workloads
- Service mesh for microservice orchestration

## Related Documentation

- [Development Guide](./DEVELOPMENT.md) - Setup and development workflow
- [API Documentation](./API.md) - API reference
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment
- [Event-Driven Architecture](./EVENT_DRIVEN_ARCHITECTURE.md) - Kafka implementation details
