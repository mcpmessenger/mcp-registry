# Setup GCP Secrets for MCP Registry
# Usage: .\scripts\setup-gcp-secrets.ps1

param(
    [string]$ProjectId = "mcp-registry-prod"
)

Write-Host "🔐 Setting up GCP Secrets" -ForegroundColor Cyan
Write-Host ""

# Set project
gcloud config set project $ProjectId

# Function to create or update secret
function Set-Secret {
    param(
        [string]$SecretName,
        [string]$Prompt
    )
    
    $existing = gcloud secrets describe $SecretName 2>$null
    if ($existing) {
        Write-Host "   Secret $SecretName already exists. Updating..." -ForegroundColor Yellow
        $value = Read-Host "Enter $Prompt" -AsSecureString
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
        $plainValue = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        echo -n $plainValue | gcloud secrets versions add $SecretName --data-file=-
    } else {
        Write-Host "   Creating secret: $SecretName" -ForegroundColor Yellow
        $value = Read-Host "Enter $Prompt" -AsSecureString
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
        $plainValue = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        echo -n $plainValue | gcloud secrets create $SecretName --data-file=-
    }
}

# Create secrets
Write-Host "Creating/updating secrets..." -ForegroundColor Yellow
Set-Secret "google-gemini-api-key" "Google Gemini API Key"
Set-Secret "google-vision-api-key" "Google Vision API Key (optional, press Enter to skip)"
Set-Secret "openai-api-key" "OpenAI API Key (optional, press Enter to skip)"
Set-Secret "encryption-secret" "Encryption Secret (random string, e.g., openssl rand -hex 32)"
Set-Secret "encryption-salt" "Encryption Salt (random string, e.g., openssl rand -hex 16)"
Set-Secret "db-password" "Database Password"

Write-Host ""
Write-Host "✅ Secrets configured!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 List of secrets:" -ForegroundColor Yellow
gcloud secrets list
