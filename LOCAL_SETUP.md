# Local Development Setup Guide

This guide will help you set up the MCP Registry locally for testing and development.

## Prerequisites

- Node.js 18+ and npm/pnpm
- Docker and Docker Compose (for Kafka)
- PostgreSQL (optional, can use SQLite for local dev)

## Quick Start

### 1. Start Kafka (Required for Orchestrator)

The orchestrator requires Kafka to be running. Start it with:

```bash
docker compose -f docker-compose.kafka.yml up -d
```

Verify Kafka is running:
```bash
docker ps | grep kafka
```

You should see both `zookeeper` and `kafka` containers running.

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment template
cp env.example.txt .env

# Edit .env and set at minimum:
# - ENABLE_KAFKA=true
# - KAFKA_BROKERS=localhost:9092
# - PORT=3001
# - DATABASE_URL (or use SQLite: file:./dev.db)

# Generate Prisma client
npm run prisma:generate

# Run migrations (if using PostgreSQL)
npm run prisma:migrate

# Start the backend
npm start
```

The backend should start on `http://localhost:3001` and you should see:
```
[Server] Kafka enabled, brokers: localhost:9092
[Server] ✓ MCP Matcher started successfully
[Server] ✓ Execution Coordinator started successfully
[Server] ✓ Result Consumer started successfully
🚀 Server running on port 3001
```

### 3. Frontend Setup

```bash
# From project root
npm install

# Start Next.js dev server
npm run dev
```

The frontend should start on `http://localhost:3000`.

## Environment Variables

### Backend (.env)

**Required for Orchestrator:**
```env
ENABLE_KAFKA=true
KAFKA_BROKERS=localhost:9092
PORT=3001
```

**Optional but Recommended:**
```env
# Database (use SQLite for local dev)
DATABASE_URL="file:./dev.db"

# For MCP server integrations
GOOGLE_GEMINI_API_KEY=your_key_here
EXA_API_KEY=your_exa_key_here
OPENAI_API_KEY=your_openai_key_here
```

**Frontend (.env.local)**
```env
# Point to local backend
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Testing the Orchestrator

1. **Check Orchestrator Status:**
   ```bash
   curl http://localhost:3001/api/orchestrator/status
   ```

   Should return:
   ```json
   {
     "kafkaEnabled": true,
     "matcherRunning": true,
     "coordinatorRunning": true,
     "resultConsumerRunning": true
   }
   ```

2. **Test a Query:**
   ```bash
   curl -X POST http://localhost:3001/api/orchestrator/query \
     -H "Content-Type: application/json" \
     -d '{"query": "when is the next iration concert in texas", "sessionId": "test-123"}'
   ```

3. **In the Frontend:**
   - Open `http://localhost:3000/chat`
   - Type a query like "when is the next iration concert in texas"
   - The orchestrator should route it to the appropriate MCP server

## Troubleshooting

### "I couldn't find an available MCP server to handle your request"

This error appears when:
1. **Kafka is not running** - Start it with `docker compose -f docker-compose.kafka.yml up -d`
2. **Orchestrator not enabled** - Check backend logs for "Kafka enabled" message
3. **No MCP servers registered** - Register some servers first:
   ```bash
   cd backend
   npm run register-top-20
   ```

### Orchestrator Timeout

If queries timeout:
1. Check Kafka is running: `docker ps | grep kafka`
2. Check backend logs for errors
3. Verify `KAFKA_BROKERS=localhost:9092` in backend `.env`
4. Check orchestrator status: `curl http://localhost:3001/api/orchestrator/status`

### Backend Won't Start

1. **Port already in use:**
   ```bash
   # Windows
   netstat -ano | findstr :3001
   # Kill the process or change PORT in .env
   ```

2. **Kafka connection failed:**
   - Ensure Kafka is running: `docker compose -f docker-compose.kafka.yml up -d`
   - Check `KAFKA_BROKERS=localhost:9092` in `.env`

3. **Database connection failed:**
   - For local dev, use SQLite: `DATABASE_URL="file:./dev.db"`
   - Or set up PostgreSQL and update `DATABASE_URL`

### Frontend Can't Connect to Backend

1. Check `NEXT_PUBLIC_API_URL` in `.env.local` points to `http://localhost:3001`
2. Verify backend is running on port 3001
3. Check CORS settings in backend (should allow `http://localhost:3000`)

## Stopping Services

```bash
# Stop Kafka
docker compose -f docker-compose.kafka.yml down

# Stop backend (Ctrl+C)

# Stop frontend (Ctrl+C)
```

## Development Workflow

1. **Start Kafka** (one time, or restart if needed):
   ```bash
   docker compose -f docker-compose.kafka.yml up -d
   ```

2. **Start Backend** (in one terminal):
   ```bash
   cd backend
   npm start
   ```

3. **Start Frontend** (in another terminal):
   ```bash
   npm run dev
   ```

4. **Test in Browser:**
   - Open `http://localhost:3000/chat`
   - Try queries like:
     - "when is the next iration concert in texas"
     - "what can you do"
     - "bro bro what can you do"

## Next Steps

- Register MCP servers: `cd backend && npm run register-top-20`
- Check orchestrator logs in backend console
- Monitor Kafka topics (optional): Use Kafka UI or CLI tools
