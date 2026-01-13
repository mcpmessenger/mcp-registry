# Testing the Pulsar Orchestrator Flow Locally

**Goal**: Verify the complete orchestration pipeline with Pulsar enabled

---

## Prerequisites

✅ **Already Running** (based on your terminal):
- Pulsar broker: `http://localhost:8080` (healthy for 3h)
- Backend server: `http://localhost:3001` (3 instances running)

---

## Step 1: Restart Backend with Pulsar Enabled

Stop all current backend instances and restart with Pulsar:

```powershell
# Kill all existing npm processes
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

# Start backend with Pulsar enabled
cd c:\Users\senti\OneDrive\Desktop\mcp-registry\backend
$env:ENABLE_PULSAR="true"
npm start
```

**Expected Output:**
```
[MCP Matcher] Started (Pulsar), listening for user requests...
[MCP Matcher]   Input: persistent://mcp-core/orchestrator/user-requests
[MCP Matcher]   Output: persistent://mcp-core/orchestrator/tool-signals
[Orchestrator Coordinator] Started (Pulsar)...
[Result Consumer] Started (Pulsar), listening for orchestrator results...
```

---

## Step 2: Verify Pulsar Topics

Check that all orchestrator topics exist:

```powershell
# List all topics in orchestrator namespace
curl http://localhost:8080/admin/v2/persistent/mcp-core/orchestrator
```

**Expected Topics:**
- `user-requests`
- `tool-signals`
- `plans`
- `results`
- `dlq`

---

## Step 3: Send a Test Request

Use the orchestrator API to send a query:

```powershell
# Test query: "What's the weather in Chicago?"
curl -X POST http://localhost:3001/api/orchestrator/query `
  -H "Content-Type: application/json" `
  -d '{
    "prompt": "What is the weather in Chicago?",
    "sessionId": "test-session-123"
  }'
```

**Expected Response (immediate):**
```json
{
  "requestId": "uuid-here",
  "status": "processing"
}
```

---

## Step 4: Monitor the Flow

Open multiple terminal windows to watch the Pulsar message flow:

### Terminal 1: Watch user-requests topic
```powershell
# Monitor incoming requests
pulsar-client consume persistent://mcp-core/orchestrator/user-requests `
  -s "test-consumer" `
  -n 0
```

### Terminal 2: Watch tool-signals topic
```powershell
# Monitor tool execution signals
pulsar-client consume persistent://mcp-core/orchestrator/tool-signals `
  -s "test-consumer-2" `
  -n 0
```

### Terminal 3: Watch results topic
```powershell
# Monitor orchestrator results
pulsar-client consume persistent://mcp-core/orchestrator/results `
  -s "test-consumer-3" `
  -n 0
```

---

## Step 5: Verify Backend Logs

Check the backend console output for orchestration flow:

**Expected Log Sequence:**
```
[MCP Matcher] Processing request abc-123: "What is the weather in Chicago?"
[MCP Matcher] Keyword match found: modelcontextprotocol/google-maps::lookup_weather (confidence: 0.98)
[MCP Matcher] Emitted TOOL_READY for abc-123
[Orchestrator Coordinator] tool-signals abc-123 invoking lookup_weather (attempt 1/3)
[Orchestrator Coordinator] Successfully published result for request abc-123
[Result Consumer] Resolving request abc-123
```

---

## Step 6: Test Retry Logic (Optional)

Simulate a failure to test Pulsar's delayed delivery:

```powershell
# Send request to non-existent server (will retry)
curl -X POST http://localhost:3001/api/orchestrator/query `
  -H "Content-Type: application/json" `
  -d '{
    "prompt": "test failure scenario",
    "sessionId": "test-retry"
  }'
```

**Expected Behavior:**
- Initial attempt fails
- After 5 seconds: automatic retry (Pulsar deliverAfter)
- After 30 seconds: second retry
- After max retries: sent to DLQ

**Logs to Watch For:**
```
[Retry] Scheduling retry for xyz-456 with 5000ms delay (attempt 1)
[Retry] Scheduling retry for xyz-456 with 30000ms delay (attempt 2)
[DLQ] Message sent to persistent://mcp-core/orchestrator/dlq for request xyz-456
```

---

## Step 7: Inspect DLQ (If Failures Occurred)

Check the dead letter queue:

```powershell
# View DLQ messages
pulsar-client consume persistent://mcp-core/orchestrator/dlq `
  -s "dlq-inspector" `
  -n 0
```

---

## Step 8: Verify Pulsar Stats

Check Pulsar topic statistics:

```powershell
# Get stats for tool-signals topic
curl http://localhost:8080/admin/v2/persistent/mcp-core/orchestrator/tool-signals/stats
```

**Key Metrics to Check:**
- `msgInCounter` - Messages received
- `msgOutCounter` - Messages delivered
- `backlogSize` - Pending messages (should be 0)
- `delayedMessageIndexSizeInBytes` - Delayed messages (retries)

---

## Troubleshooting

### Backend not picking up Pulsar config?
```powershell
# Verify environment variable
echo $env:ENABLE_PULSAR  # Should output "true"

# Check .env file
Get-Content .env | Select-String "PULSAR"
```

### Topics not found?
```powershell
# Re-run namespace initialization
npx ts-node scripts/init-pulsar-orchestrator.ts
```

### No messages flowing?
```bash
# Check Pulsar broker health
curl http://localhost:8080/admin/v2/brokers/health

# Check namespace permissions
curl http://localhost:8080/admin/v2/namespaces/mcp-core/orchestrator
```

---

## Success Criteria

✅ **Orchestration Working** when you see:
1. Request received in `user-requests` topic
2. Matcher emits to `tool-signals` topic
3. Coordinator executes tool
4. Result appears in `results` topic
5. Frontend receives result via WebSocket/SSE

✅ **Retry Working** when you see:
1. Failed request triggers retry
2. 5-second delay before first retry
3. 30-second delay before second retry
4. DLQ receives message after max retries

---

## Next Steps After Successful Test

1. **Test with real MCP servers** - Weather, search, etc.
2. **Load test** - Send multiple concurrent requests
3. **Deploy to Cloud Run** - Once Artifact Registry fixed
4. **Connect StreamNative Cloud** - For production Pulsar

---

**Quick Test Command:**
```powershell
# One-liner to test the flow
curl -X POST http://localhost:3001/api/orchestrator/query -H "Content-Type: application/json" -d '{"prompt":"weather in Chicago","sessionId":"test"}' ; Start-Sleep -Seconds 2 ; Get-Content backend/logs/latest.log | Select-Object -Last 20
```
