param(
  [string]$BaseUrl = "http://localhost:3001",
  [string]$Query = "what's the weather in des moines",
  [int]$PollSeconds = 2,
  [int]$MaxPolls = 60
)

$ErrorActionPreference = "Stop"

Write-Host "[JobsTest] Creating orchestrator job..."

$createBody = @{
  query = $Query
} | ConvertTo-Json

$createResp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/orchestrator/jobs" -ContentType "application/json" -Body $createBody

$jobId = $createResp.jobId
$requestId = $createResp.requestId

Write-Host "[JobsTest] jobId=$jobId requestId=$requestId status=$($createResp.status)"

for ($i = 1; $i -le $MaxPolls; $i++) {
  Start-Sleep -Seconds $PollSeconds

  $jobResp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/orchestrator/jobs/$jobId"
  $status = $jobResp.job.status

  Write-Host ("[JobsTest] Poll {0}/{1}: status={2}" -f $i, $MaxPolls, $status)

  if ($status -eq "COMPLETED" -or $status -eq "FAILED" -or $status -eq "CANCELLED") {
    Write-Host "[JobsTest] Terminal status reached."
    Write-Host ($jobResp | ConvertTo-Json -Depth 20)
    exit 0
  }
}

Write-Host "[JobsTest] Timed out waiting for terminal job status."
exit 1

