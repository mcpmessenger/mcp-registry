# MCP Registry - Pulsar Migration

Quick reference for running the migrated infrastructure.

## Starting Pulsar

```bash
# Start Pulsar standalone
docker compose up -d

# Check health
docker compose ps

# View logs
docker compose logs -f pulsar
```

## Initialize Pulsar Namespaces

```bash
cd backend

# Run initialization script
npm run init-pulsar
```

This creates:
- Tenant: `mcp-core`
- Namespace: `mcp-core/registrations` (infinite retention)
- Namespace: `mcp-core/sessions` (1 hour TTL)
- Namespace: `mcp-core/events` (5 minute TTL)

## Starting the Backend

```bash
cd backend

# Make sure .env has ENABLE_PULSAR=true
npm start
```

## Testing the /mcp Endpoint

### 1. Initialize Session

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {},
    "id": 1
  }'
```

Response includes `Mcp-Session-Id` header.

### 2. Open SSE Stream

```bash
# Replace {SESSION_ID} with the ID from step 1
curl -N -H "Accept: text/event-stream" \
  -H "Mcp-Session-Id: {SESSION_ID}" \
  http://localhost:3001/mcp
```

You should see keep-alive messages every 15 seconds.

### 3. Register a Server

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: {SESSION_ID}" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/register",
    "params": {
      "serverInfo": {
        "name": "test-server",
        "version": "1.0.0"
      }
    },
    "id": 2
  }'
```

## Pulsar Admin Commands

```bash
# List tenants
curl http://localhost:8080/admin/v2/tenants

# List namespaces
curl http://localhost:8080/admin/v2/namespaces/mcp-core

# List topics
curl http://localhost:8080/admin/v2/persistent/mcp-core/registrations

# Check topic stats
curl http://localhost:8080/admin/v2/persistent/mcp-core/registrations/global/stats
```

## Environment Variables

Key variables in `backend/.env`:

```bash
ENABLE_PULSAR=true
PULSAR_SERVICE_URL=pulsar://localhost:6650
PULSAR_HTTP_URL=http://localhost:8080
MCP_SESSION_TTL=3600
MCP_ALLOWED_ORIGINS=http://localhost:3000
```
