# Quick Start Guide

## Start Everything Locally

### 1. Start Kafka (Required)
```powershell
# Windows PowerShell
docker compose -f docker-compose.kafka.yml up -d

# Or use the helper script
.\scripts\start-local.ps1
```

### 2. Start Backend
```powershell
cd backend
npm install  # First time only
npm start
```

**First time setup:**
```powershell
cd backend
copy env.example.txt .env
# Edit .env and add:
#   ENABLE_KAFKA=true
#   KAFKA_BROKERS=localhost:9092
npm run prisma:generate
```

### 3. Start Frontend
```powershell
# From project root
npm install  # First time only
npm run dev
```

### 4. Test It
1. Open http://localhost:3000/chat
2. Try: "what can you do" or "bro bro what can you do"
3. Check backend console for orchestrator status

## Verify Orchestrator

```powershell
# Check orchestrator status
curl http://localhost:3001/api/orchestrator/status

# Should show:
# {
#   "kafka": { "enabled": true, "brokers": ["localhost:9092"] },
#   "services": { "matcher": true, "coordinator": true, "resultConsumer": true }
# }
```

## Common Issues

**"I couldn't find an available MCP server"**
- Check Kafka is running: `docker ps | grep kafka`
- Check backend logs show "Kafka enabled"
- Register servers: `cd backend && npm run register-top-20`

**Orchestrator timeout**
- Verify Kafka: `docker compose -f docker-compose.kafka.yml ps`
- Check `KAFKA_BROKERS=localhost:9092` in backend `.env`
- Restart backend after changing `.env`

**Frontend can't connect**
- Verify backend on http://localhost:3001/health
- Check `NEXT_PUBLIC_API_URL=http://localhost:3001` in `.env.local`

## Stop Everything

```powershell
# Stop Kafka
docker compose -f docker-compose.kafka.yml down

# Stop backend/frontend: Ctrl+C
```

For detailed setup, see [LOCAL_SETUP.md](./LOCAL_SETUP.md)
