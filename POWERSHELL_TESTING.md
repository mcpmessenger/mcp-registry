# PowerShell Testing Commands for MCP Registry

## Start Backend (with Pulsar)
```powershell
cd c:\Users\senti\OneDrive\Desktop\mcp-registry\backend
$env:ENABLE_PULSAR="true"
npx ts-node --transpile-only src/server.ts
```

## Test Orchestrator Flow

### Method 1: Using Invoke-RestMethod (Recommended)
```powershell
$response = Invoke-RestMethod -Uri "http://localhost:3001/api/orchestrator/query" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"prompt":"What is the weather in Chicago?","sessionId":"test-123"}'

$response
```

### Method 2: Using Invoke-WebRequest (More Details)
```powershell
$body = @{
    prompt = "What is the weather in Chicago?"
    sessionId = "test-123"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:3001/api/orchestrator/query" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

$response.Content | ConvertFrom-Json
```

### Method 3: One-liner
```powershell
(Invoke-RestMethod -Uri http://localhost:3001/api/orchestrator/query -Method POST -ContentType "application/json" -Body '{"prompt":"weather in Chicago","sessionId":"test"}')
```

## Test Health Endpoint
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/health"
```

## Test MCP Endpoint
```powershell
# Initialize MCP session
$response = Invoke-RestMethod -Uri "http://localhost:3001/mcp" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}'

$response
```

## Check Pulsar Topics
```powershell
# List orchestrator topics
Invoke-RestMethod -Uri "http://localhost:8080/admin/v2/persistent/mcp-core/orchestrator"

# Get topic stats
Invoke-RestMethod -Uri "http://localhost:8080/admin/v2/persistent/mcp-core/orchestrator/tool-signals/stats"
```

## Monitor Backend Logs (Real-time)
```powershell
# In separate terminal - watch logs
Get-Content -Path ".\logs\backend.log" -Wait -Tail 20
```

## Quick Troubleshooting

### Check if backend is running
```powershell
Test-NetConnection -ComputerName localhost -Port 3001
```

### Kill all Node processes
```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
```

### Check Pulsar health
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/admin/v2/brokers/health"
```
