# Development Guide

Complete guide for setting up and developing the MCP Registry platform.

## Prerequisites

- **Node.js** 18+ (for backend and frontend)
- **npm** or **pnpm** (frontend uses pnpm)
- **PostgreSQL** (recommended) or SQLite (development)
- **Docker** (optional, for Kafka)
- **Git**

## Quick Start

### 1. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Set up environment variables
cp env.example.txt .env
# Edit .env with your configuration

# Run database migrations
npm run migrate

# Seed initial data
npm run seed

# Start development server
npm start
```

The backend will be available at `http://localhost:3001`

### 2. Frontend Setup

```bash
cd mcp-registry-main

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The frontend will be available at `http://localhost:3000`

## Environment Variables

### Backend (.env)

See `backend/env.example.txt` for complete template. Key variables:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/mcp_registry"

# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN="http://localhost:3000"

# Google APIs (required for SVG generation and document analysis)
GOOGLE_GEMINI_API_KEY=your_key
GOOGLE_VISION_API_KEY=your_key

# OpenAI (required for voice transcription)
OPENAI_API_KEY=your_key

# Kafka (optional, for event-driven architecture)
KAFKA_BROKERS=localhost:9092
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Database Setup

### PostgreSQL (Recommended)

1. Install PostgreSQL locally or use a managed service
2. Create database:
   ```sql
   CREATE DATABASE mcp_registry;
   CREATE USER mcp_registry WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE mcp_registry TO mcp_registry;
   ```
3. Update `DATABASE_URL` in `.env`
4. Run migrations: `npm run migrate`

### SQLite (Development Only)

```bash
# Uses file:./dev.db automatically
npm run migrate
```

## Development Workflow

### Running Both Services

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd mcp-registry-main
pnpm dev
```

### Making Database Changes

When you modify `backend/prisma/schema.prisma`:

```bash
cd backend
npm run migrate
```

This creates a new migration and applies it to the database.

### Viewing Database

Use Prisma Studio:
```bash
cd backend
npm run prisma:studio
```

Opens at `http://localhost:5555`

## Testing

### Backend API Tests

```bash
cd backend
npm test
```

### Manual API Testing

**Health Check:**
```bash
curl http://localhost:3001/health
```

**List Servers:**
```bash
curl http://localhost:3001/v0.1/servers
```

**Generate SVG:**
```bash
curl -X POST http://localhost:3001/api/mcp/tools/generate \
  -H "Content-Type: application/json" \
  -d '{"description": "minimalist icon, blue palette"}'
```

### Frontend Testing

```bash
cd mcp-registry-main
pnpm test
```

## Project Structure

### Backend (`backend/`)

```
backend/
├── src/
│   ├── config/          # Configuration (env, database, Kafka)
│   ├── integrations/    # External API clients (Google, OpenAI)
│   ├── middleware/      # Express middleware (CORS, SSE, errors)
│   ├── repositories/    # Data access layer
│   ├── routes/          # API route handlers
│   │   ├── v0/         # Registry v0.1 API
│   │   ├── mcp/        # MCP tool endpoints
│   │   └── streams/    # SSE endpoints
│   ├── services/        # Business logic
│   ├── scripts/         # Utility scripts (seed, etc.)
│   ├── types/           # TypeScript types
│   └── server.ts        # Express app entry point
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── migrations/      # Migration history
└── package.json
```

### Frontend (`mcp-registry-main/`)

```
mcp-registry-main/
├── app/                 # Next.js app router pages
│   ├── chat/           # Chat interface
│   ├── settings/       # Settings pages
│   └── page.tsx        # Main registry page
├── components/          # React components
│   ├── ui/             # Reusable UI components
│   └── ...             # Feature components
├── lib/                 # Utilities and API client
├── types/               # TypeScript types
└── package.json
```

## Code Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Avoid `any` types
- Use interfaces for object shapes
- Export types from appropriate modules

### Frontend

- Follow React best practices
- Use functional components and hooks
- Keep components small and focused
- Use Tailwind CSS for styling

### Backend

- Follow Express.js best practices
- Use Prisma for all database operations
- Add proper error handling
- Validate input data with Zod
- Use environment variables for configuration

## Common Tasks

### Register a New MCP Server

```bash
curl -X POST http://localhost:3001/v0.1/publish \
  -H "Content-Type: application/json" \
  -d @server-manifest.json
```

See [API Documentation](./API.md) for server manifest format.

### Update Playwright Server

```bash
cd backend
npm run fix-playwright
npm run update-playwright-http https://your-server-url/mcp
```

### Debug Kafka Events

Start Kafka with Docker:
```bash
docker compose -f docker-compose.kafka.yml up -d
```

Monitor topics:
```bash
# Requires Kafka CLI tools
kafka-console-consumer --bootstrap-server localhost:9092 --topic design-requests
```

## Troubleshooting

### Port Already in Use

Change `PORT` in `.env` or kill the process:
```bash
# Find process
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Database Connection Issues

1. Verify `DATABASE_URL` is correct
2. Check PostgreSQL is running: `pg_isready`
3. Test connection: `psql $DATABASE_URL`

### CORS Errors

Ensure `CORS_ORIGIN` in backend `.env` matches your frontend URL.

### API Key Errors

- Verify keys are set in `.env`
- Check API keys are valid in Google Cloud Console
- Ensure billing is enabled for Google Cloud project

## Next Steps

- See [Deployment Guide](./DEPLOYMENT.md) for production setup
- See [Architecture Documentation](./ARCHITECTURE.md) for system design
- See [API Documentation](./API.md) for API reference





