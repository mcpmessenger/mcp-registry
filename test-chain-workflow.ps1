# Quick Test: Chain Workflow
# Tests the orchestration system with a simple navigate + screenshot workflow

$baseUrl = "http://localhost:3001"
$conversationId = "test-$(Get-Date -Format 'yyyyMMddHHmmss')"

Write-Host "🧪 Testing Chain Workflow" -ForegroundColor Cyan
Write-Host "Conversation ID: $conversationId" -ForegroundColor Gray
Write-Host ""

# Step 1: Navigate
Write-Host "1️⃣ Navigating to google.com..." -ForegroundColor Yellow
$navBody = @{
    serverId = "com.microsoft.playwright/mcp"
    tool = "browser_navigate"
    arguments = @{
        url = "https://google.com"
    }
    conversationId = $conversationId
    intent = "Take a screenshot of google.com"
} | ConvertTo-Json

try {
    $navResponse = Invoke-WebRequest -Uri "$baseUrl/v0.1/invoke" `
        -Method POST `
        -ContentType "application/json" `
        -Body $navBody `
        -UseBasicParsing

    $navResult = $navResponse.Content | ConvertFrom-Json
    if ($navResult.success) {
        Write-Host "   ✅ Navigation completed" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Navigation failed: $($navResult.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ❌ Navigation error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Wait for page to load
Write-Host "`n2️⃣ Waiting for page to load (3 seconds)..." -ForegroundColor Yellow
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

try {
    $screenshotResponse = Invoke-WebRequest -Uri "$baseUrl/v0.1/invoke" `
        -Method POST `
        -ContentType "application/json" `
        -Body $screenshotBody `
        -UseBasicParsing

    $screenshotResult = $screenshotResponse.Content | ConvertFrom-Json
    if ($screenshotResult.success) {
        Write-Host "   ✅ Screenshot completed" -ForegroundColor Green
        $contentCount = $screenshotResult.result.content.Count
        Write-Host "   📊 Result: $contentCount content item(s)" -ForegroundColor Cyan
        
        # Check if screenshot has image data
        $hasImage = $screenshotResult.result.content | Where-Object { $_.type -eq 'image' }
        if ($hasImage) {
            Write-Host "   🖼️  Screenshot image captured!" -ForegroundColor Green
        }
    } else {
        Write-Host "   ❌ Screenshot failed: $($screenshotResult.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Screenshot error: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 4: Check workflow state
Write-Host "`n4️⃣ Checking workflow state in registry..." -ForegroundColor Yellow
$serverId = "com.microsoft.playwright%2Fmcp"
try {
    $serverResponse = Invoke-WebRequest -Uri "$baseUrl/v0.1/servers/$serverId" `
        -UseBasicParsing

    $server = $serverResponse.Content | ConvertFrom-Json
    if ($server.metadata.workflow) {
        Write-Host "   📋 Workflow State: $($server.metadata.workflow.state)" -ForegroundColor Cyan
        Write-Host "   🔒 Locked By: $($server.metadata.workflow.lockedBy)" -ForegroundColor Cyan
        Write-Host "   🔄 Attempts: $($server.metadata.workflow.attempts)" -ForegroundColor Cyan
        Write-Host "   🆔 Context ID: $($server.metadata.workflow.contextId)" -ForegroundColor Cyan
    } else {
        Write-Host "   ⚠️  No workflow state found (workflow may not have been tracked)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Could not check workflow state: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 5: Check memory snapshot
Write-Host "`n5️⃣ Checking memory snapshot..." -ForegroundColor Yellow
try {
    $memoryResponse = Invoke-WebRequest -Uri "$baseUrl/api/memory?conversationId=$conversationId" `
        -UseBasicParsing

    $memory = $memoryResponse.Content | ConvertFrom-Json
    if ($memory.success) {
        Write-Host "   ✅ Memory snapshot available" -ForegroundColor Green
        Write-Host "   📊 Memories: $($memory.count)" -ForegroundColor Cyan
        Write-Host "   🔗 Snapshot URL: $baseUrl/api/memory?conversationId=$conversationId" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ⚠️  Could not check memory: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n✅ Chain workflow test complete!" -ForegroundColor Green
Write-Host "`n💡 Tip: Check Kafka events with:" -ForegroundColor Gray
Write-Host "   kafka-console-consumer --bootstrap-server localhost:9092 --topic mcp.events.all --from-beginning" -ForegroundColor DarkGray
