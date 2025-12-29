<#
.SYNOPSIS
Starts the production-like dependencies (Kafka + Cloud SQL proxy) before launching the backend.
This script is handy when you already have the frontend/backend code and want to bring up the event-driven pipeline locally
while mirroring the production configuration (Kafka + Cloud SQL socket).
#>

param(
    [string]$KafkaComposeFile = "docker-compose.kafka.yml",
    [string]$CloudSqlInstance = "slashmcp:us-central1:mcp-registry-db",
    [int]$CloudSqlPort = 5432,
    [string]$BackendDir = "backend"
)

Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")

Push-Location $repoRoot
try {
    if (-not (Test-Path $KafkaComposeFile)) {
        throw "Kafka compose file '$KafkaComposeFile' not found from $repoRoot."
    }

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker is not on PATH. Install Docker Desktop and retry."
    }

    Write-Host "Bringing up Kafka stack via '$KafkaComposeFile'..."
    & docker compose -f $KafkaComposeFile up -d | Out-Null
    Write-Host "Kafka containers should be running (use 'docker ps' to verify)."

    $cloudProxyExe = Join-Path $repoRoot "cloud-sql-proxy.exe"
    $cloudSqlProxyProcess = $null

    if (Test-Path $cloudProxyExe) {
        $proxyArgs = "-instances=$CloudSqlInstance=tcp:$CloudSqlPort"
        Write-Host "Starting Cloud SQL Proxy ($proxyArgs)..."
        $cloudSqlProxyProcess = Start-Process -FilePath $cloudProxyExe `
            -ArgumentList $proxyArgs `
            -WorkingDirectory $repoRoot `
            -WindowStyle Hidden `
            -PassThru
        Write-Host "Cloud SQL Proxy running in background (PID $($cloudSqlProxyProcess.Id))."
    } else {
        Write-Warning "cloud-sql-proxy.exe missing from the repo root; install it or run the proxy manually."
    }

    $backendPath = Join-Path $repoRoot $BackendDir
    if (-not (Test-Path $backendPath)) {
        throw "Backend directory '$BackendDir' not found."
    }

    Write-Host "Ensure 'backend/.env' has production variables (DATABASE_URL uses Cloud SQL socket, ENABLE_KAFKA=true)."

    Push-Location $backendPath
    Write-Host "Starting backend with 'npm start'..."
    & npm start
}
finally {
    Pop-Location
    if ($cloudSqlProxyProcess) {
        Write-Host "Stopping Cloud SQL Proxy (PID $($cloudSqlProxyProcess.Id))."
        try {
            $cloudSqlProxyProcess | Stop-Process -Force
        } catch {
            Write-Warning "Could not stop Cloud SQL Proxy: $_"
        }
    }
    Pop-Location
}

