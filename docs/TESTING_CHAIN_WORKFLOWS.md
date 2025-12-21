# Testing Chain Workflows

This guide shows you how to test multi-step orchestration workflows in the MCP Registry.

## Prerequisites

1. **Backend running**: `cd backend && npm run dev`
2. **Frontend running**: `npm run dev`
3. **Kafka running** (optional but recommended): `docker-compose -f docker-compose.kafka.yml up -d`
4. **Playwright MCP server registered** (for browser automation workflows)

## How Chain Workflows Work

The system supports **natural language orchestration** - you describe what you want in plain English, and the system automatically chains tools together.

### Example: Multi-Step Playwright Workflow

When you say: **"take a screenshot of google.com"**

The system automatically:
1. Detects you want a screenshot AND a URL
2. Calls `browser_navigate` to go to google.com
3. Waits for page to load
4. Calls `browser_take_screenshot` to capture the page
5. Returns the screenshot

All of this happens automatically - no workflow builder needed!

## Testing Methods

### Method 1: Via Chat Interface (Easiest)

1. **Open the chat**: Navigate to `http://localhost:3000/chat`
2. **Select Playwright agent**: Choose "Playwright MCP Server" from the agent dropdown
3. **Try these test scenarios**:

#### Test 1: Navigate + Screenshot
```
User: "take a screenshot of google.com"
```
**Expected**: System navigates to Google, waits, then takes screenshot

#### Test 2: Navigate + Snapshot
```
User: "go to example.com and show me the page structure"
```
**Expected**: Navigates to example.com, then calls `browser_snapshot` for accessibility tree

#### Test 3: Multi-step with explicit commands
```
User: "navigate to github.com, wait 2 seconds, then take a full page screenshot"
```
**Expected**: Navigates → waits → takes full page screenshot

### Method 2: Direct API Testing

Test the orchestration via API calls:

```powershell
# Test 1: Navigate + Screenshot workflow
$body = @{
    serverId = "com.microsoft.playwright/mcp"
    tool = "browser_navigate"
    arguments = @{
        url = "https://google.com"
    }
    conversationId = "test-conv-123"
    intent = "Take a screenshot of google.com"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3001/v0.1/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

# Wait a moment, then take screenshot
Start-Sleep -Seconds 3

$screenshotBody = @{
    serverId = "com.microsoft.playwright/mcp"
    tool = "browser_take_screenshot"
    arguments = @{
        type = "png"
        fullPage = false
    }
    conversationId = "test-conv-123"
    intent = "Take a screenshot of google.com"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3001/v0.1/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $screenshotBody
```

### Method 3: Monitor Workflow State

Check the registry to see workflow state transitions:

```powershell
# Get server with workflow state
$serverId = "com.microsoft.playwright%2Fmcp"
Invoke-WebRequest -Uri "http://localhost:3001/v0.1/servers/$serverId" `
    -UseBasicParsing | 
    Select-Object -ExpandProperty Content | 
    ConvertFrom-Json | 
    Select-Object -ExpandProperty metadata | 
    Select-Object -ExpandProperty workflow
```

**Expected response**:
```json
{
  "state": "VisionAnalyzing",
  "lockedBy": "com.microsoft.playwright/mcp",
  "attempts": 0,
  "contextId": "test-conv-123",
  "updatedAt": "2024-12-21T10:30:00Z"
}
```

### Method 4: Monitor Kafka Events

Watch for handover events in Kafka:

```powershell
# If you have kafka-console-consumer installed
kafka-console-consumer --bootstrap-server localhost:9092 \
    --topic mcp.events.all \
    --from-beginning
```

**Expected events**:
```json
{
  "event": "tool.browser_navigate.completed",
  "serverId": "com.microsoft.playwright/mcp",
  "payload": {
    "contextId": "test-conv-123",
    "intent": "Take a screenshot of google.com",
    "lastToolOutput": {
      "tool": "browser_navigate",
      "serverId": "com.microsoft.playwright/mcp",
      "result": { ... },
      "timestamp": "2024-12-21T10:30:00Z"
    },
    "memorySnapshotUrl": "http://localhost:3001/api/memory?conversationId=test-conv-123",
    "status": "success"
  },
  "timestamp": "2024-12-21T10:30:00Z",
  "correlationId": "..."
}
```

## Test Scenarios

### Scenario 1: Simple Screenshot Workflow

**Input**: "screenshot google.com"

**Workflow**:
1. ✅ Detect URL in message
2. ✅ Navigate to https://google.com
3. ✅ Wait for page load
4. ✅ Take screenshot
5. ✅ Return image

**How to verify**:
- Check chat for screenshot image
- Check browser console for event logs
- Check registry workflow state

### Scenario 2: Multi-Tool Chain

**Input**: "go to example.com, click on the 'More information' link, then take a screenshot"

**Workflow**:
1. Navigate to example.com
2. Find "More information" link (browser_snapshot)
3. Click the link (browser_click)
4. Wait for navigation
5. Take screenshot

**Note**: This requires the frontend to parse complex intents. Currently, the system handles simple cases like "navigate + screenshot".

### Scenario 3: Error Recovery (DLQ/Healer)

**Input**: Trigger a tool that fails

**Workflow**:
1. Tool invocation fails
2. Event sent to DLQ
3. Healer service attempts recovery
4. If max retries exceeded, state transitions to "PlanB"

**How to verify**:
```powershell
# Check DLQ topic
kafka-console-consumer --bootstrap-server localhost:9092 \
    --topic mcp.events.dlq \
    --from-beginning

# Check registry for PlanB state
Invoke-WebRequest -Uri "http://localhost:3001/v0.1/servers/com.microsoft.playwright%2Fmcp" `
    -UseBasicParsing | 
    Select-Object -ExpandProperty Content | 
    ConvertFrom-Json | 
    Select-Object -ExpandProperty metadata | 
    Select-Object -ExpandProperty workflow
```

## Observing Workflow Progress

### 1. Browser Console

Open browser DevTools (F12) and watch the console:

```
🔧 Multi-step operation detected: { wantsNavigate: true, wantsScreenshot: true }
Extracted URL: https://google.com
Step 1: Navigating to https://google.com
Step 2: Waiting 3 seconds for page to load...
Step 3: Taking screenshot...
Screenshot result: { content: [...] }
```

### 2. Backend Logs

Watch the backend terminal for:

```
📤 Published event tool.browser_navigate.completed for job ... to topic mcp.events.all
📤 Published event tool.browser_take_screenshot.completed for job ... to topic mcp.events.all
✅ Healer service started - watching DLQ for failed events
```

### 3. Registry API

Query the registry to see workflow state:

```bash
curl http://localhost:3001/v0.1/servers/com.microsoft.playwright%2Fmcp | jq '.metadata.workflow'
```

## Advanced Testing: Event-Driven Workflows

The system supports event-driven workflows where one tool triggers another automatically.

### Example: Vision → Researcher Workflow

Currently implemented in `workflow-example.service.ts`:

1. Playwright takes screenshot → emits `vision.captured` event
2. Researcher service listens for `vision.captured`
3. Researcher processes the image
4. Results stored in memory

**To test**:
1. Take a screenshot via Playwright
2. Check backend logs for: `🔔 Vision captured event received`
3. Researcher should automatically process it (if registered)

## Troubleshooting

### Workflow not chaining?

1. **Check agent selection**: Make sure you've selected the right agent (e.g., Playwright)
2. **Check URL detection**: The system needs to detect URLs in your message
3. **Check console**: Look for "Multi-step operation detected" logs

### Events not appearing?

1. **Check Kafka**: Is Kafka running? `docker ps | grep kafka`
2. **Check backend logs**: Look for "Failed to emit event" errors
3. **Check topic**: Verify topics exist: `kafka-topics --list --bootstrap-server localhost:9092`

### Workflow state not updating?

1. **Check database**: Verify migration ran: `cd backend && npx prisma migrate status`
2. **Check registry service**: Ensure workflow methods are being called
3. **Check API response**: Verify `metadata.workflow` appears in server responses

## Next Steps

Once basic workflows work:

1. **Add more tool chains**: Extend the frontend to handle more complex intents
2. **Create custom workflows**: Use the event-bus-consumer to register new workflows
3. **Monitor orchestration**: Set up observability dashboard for workflow visualization
4. **Test error recovery**: Intentionally fail tools to test Healer service

## Example Test Script

Save this as `test-workflow.ps1`:

```powershell
# Test Chain Workflow Script

$baseUrl = "http://localhost:3001"
$conversationId = "test-$(Get-Date -Format 'yyyyMMddHHmmss')"

Write-Host "🧪 Testing Chain Workflow" -ForegroundColor Cyan
Write-Host "Conversation ID: $conversationId" -ForegroundColor Gray

# Step 1: Navigate
Write-Host "`n1️⃣ Navigating to google.com..." -ForegroundColor Yellow
$navBody = @{
    serverId = "com.microsoft.playwright/mcp"
    tool = "browser_navigate"
    arguments = @{
        url = "https://google.com"
    }
    conversationId = $conversationId
    intent = "Take a screenshot of google.com"
} | ConvertTo-Json

$navResponse = Invoke-WebRequest -Uri "$baseUrl/v0.1/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $navBody `
    -UseBasicParsing

Write-Host "   ✅ Navigation completed" -ForegroundColor Green

# Step 2: Wait
Write-Host "`n2️⃣ Waiting for page to load..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Step 3: Screenshot
Write-Host "`n3️⃣ Taking screenshot..." -ForegroundColor Yellow
$screenshotBody = @{
    serverId = "com.microsoft.playwright/mcp"
    tool = "browser_take_screenshot"
    arguments = @{
        type = "png"
        fullPage = false
    }
    conversationId = $conversationId
    intent = "Take a screenshot of google.com"
} | ConvertTo-Json

$screenshotResponse = Invoke-WebRequest -Uri "$baseUrl/v0.1/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $screenshotBody `
    -UseBasicParsing

$result = $screenshotResponse.Content | ConvertFrom-Json
Write-Host "   ✅ Screenshot completed" -ForegroundColor Green
Write-Host "   Result: $($result.result.content.Count) content items" -ForegroundColor Gray

# Step 4: Check workflow state
Write-Host "`n4️⃣ Checking workflow state..." -ForegroundColor Yellow
$serverId = "com.microsoft.playwright%2Fmcp"
$serverResponse = Invoke-WebRequest -Uri "$baseUrl/v0.1/servers/$serverId" `
    -UseBasicParsing

$server = $serverResponse.Content | ConvertFrom-Json
if ($server.metadata.workflow) {
    Write-Host "   Workflow State: $($server.metadata.workflow.state)" -ForegroundColor Cyan
    Write-Host "   Locked By: $($server.metadata.workflow.lockedBy)" -ForegroundColor Cyan
    Write-Host "   Attempts: $($server.metadata.workflow.attempts)" -ForegroundColor Cyan
}

Write-Host "`n✅ Workflow test complete!" -ForegroundColor Green
```

Run it:
```powershell
.\test-workflow.ps1
```
