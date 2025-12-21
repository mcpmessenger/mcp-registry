# Migration Guide - Agentic Upgrades

## Overview

This migration adds:
1. Memory system for agent context storage
2. Cross-server Pub/Sub event bus
3. Enhanced OAuth for third-party MCP servers

## Prerequisites

- PostgreSQL database (or SQLite for dev)
- Kafka running (optional, but required for Pub/Sub)
- Environment variables set (see below)

## Step 1: Set Environment Variables

Add to `backend/.env`:

```env
# Token Encryption (REQUIRED for OAuth)
ENCRYPTION_SECRET=your_secure_random_string_here
ENCRYPTION_SALT=your_secure_random_string_here
```

Generate secure values:
```bash
openssl rand -base64 32  # For ENCRYPTION_SECRET
openssl rand -base64 32  # For ENCRYPTION_SALT
```

## Step 2: Run Database Migration

```bash
cd backend
npm run migrate
```

This will:
- Remove duplicate Conversation/Message/ToolInvocation/Memory models
- Add `authConfig`, `encryptedTokens`, `tokenExpiresAt` to `McpServer`
- Add indexes to Memory model

## Step 3: Verify Migration

Check that new fields exist:

```sql
-- Check McpServer has new fields
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'McpServer' 
AND column_name IN ('authConfig', 'encryptedTokens', 'tokenExpiresAt');

-- Check Memory model exists (should be only one)
SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'Memory';
```

## Step 4: Restart Backend

```bash
npm start
```

You should see:
- ✅ Event bus consumer started
- ✅ Vision-to-Researcher workflow registered

## Step 5: Test Features

### Test Memory API

```bash
# Store context
curl -X POST http://localhost:3001/api/memory/context \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "test_conv_123",
    "context": {
      "toolOutputs": {
        "browser_navigate": { "url": "https://example.com", "status": "success" }
      },
      "conversationState": { "currentPage": "home" }
    }
  }'

# Search history
curl -X POST http://localhost:3001/api/memory/search \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "test_conv_123",
    "query": "navigate"
  }'
```

### Test Event Bus

Invoke a tool and check Kafka:

```bash
# In another terminal
kafka-console-consumer.sh --topic mcp.events.all --bootstrap-server localhost:9092 --from-beginning
```

Then invoke a tool - you should see events emitted.

### Test OAuth

```bash
# Register a server with OAuth config (via API)
curl -X POST http://localhost:3001/v0.1/publish \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "com.example/mcp-server",
    "name": "Example MCP Server",
    "authConfig": {
      "authorizationUrl": "https://example.com/oauth/authorize",
      "tokenUrl": "https://example.com/oauth/token",
      "clientId": "your_client_id",
      "clientSecret": "your_client_secret",
      "scopes": ["read", "write"],
      "redirectUri": "http://localhost:3001/api/auth/mcp/com.example%2Fmcp-server/callback"
    }
  }'

# Initiate OAuth flow
curl http://localhost:3001/api/auth/mcp/com.example%2Fmcp-server/authorize
```

## Troubleshooting

### Migration Fails

If migration fails due to duplicate models:
1. Manually remove lines 162-237 from `schema.prisma`
2. Run migration again

### Kafka Not Running

Pub/Sub features will be disabled if Kafka is unavailable. The server will still start and basic MCP functionality will work.

### Encryption Errors

Make sure `ENCRYPTION_SECRET` and `ENCRYPTION_SALT` are set. They must be the same across restarts to decrypt existing tokens.

## Rollback

If you need to rollback:

1. Restore previous `schema.prisma`
2. Run migration: `npm run migrate`
3. Remove new service files (optional)

## Next Steps

After migration:
1. Update frontend to use memory API
2. Add conversation persistence
3. Create custom workflows
4. Register servers with OAuth config

---

**Status**: ✅ Migration ready - run `npm run migrate` to apply
