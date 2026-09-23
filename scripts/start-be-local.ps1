# Local-only helper: inject JWT_SECRET from the Windows user store into the
# backend child process. Values are never printed.
param([int]$Port = 8090)
function Resolve-LocalSecret {
    param([string]$Name)
    $value = [Environment]::GetEnvironmentVariable($Name, 'User')
    if (-not $value -and (Test-Path 'D:\HealthCare_Project\.env')) {
        $line = Select-String -Path 'D:\HealthCare_Project\.env' -Pattern ('^' + [regex]::Escape($Name) + '=') | Select-Object -First 1
        if ($line) { $value = $line.Line.Substring(($Name + '=').Length).Trim() }
    }
    return $value
}

$secret = Resolve-LocalSecret 'JWT_SECRET'
if (-not $secret) {
    Write-Error 'JWT_SECRET not found in user store or .env'
    exit 1
}
Write-Output ('JWT_SECRET resolved: yes (len ' + $secret.Length + ')')
$env:JWT_SECRET = $secret
# Must be the same value the frontend BFF and `playwright.compose.config.ts` read, otherwise every
# server-to-server call fails the trusted-credential check while looking like an authorization bug.
$bffToken = Resolve-LocalSecret 'BACKEND_BFF_SERVICE_TOKEN'
if (-not $bffToken) {
    Write-Error 'BACKEND_BFF_SERVICE_TOKEN not found in user store or .env'
    exit 1
}
$env:BACKEND_BFF_SERVICE_TOKEN = $bffToken
Write-Output ('BACKEND_BFF_SERVICE_TOKEN resolved: yes (len ' + $bffToken.Length + ')')

# Point the backend at the local ai-service so /ready reports ai_ready:true.
# The shared token must match the AI service's AI_SERVICE_TOKEN.
$aiToken = Resolve-LocalSecret 'AI_SERVICE_TOKEN'
if ($aiToken) {
    $env:AI_SERVICE_URL = 'http://127.0.0.1:8000'
    $env:AI_SERVICE_TOKEN = $aiToken
    Write-Output ('AI_SERVICE_TOKEN resolved: yes (len ' + $aiToken.Length + '), AI_SERVICE_URL=http://127.0.0.1:8000')
} else {
    Write-Output 'AI_SERVICE_TOKEN resolved: no (backend boots, ai_ready stays false)'
}

# Without this the backend silently falls back to application.yml's Compose
# default (localhost:5434), which is a different database with a different seed,
# and a live-tier failure then looks like an application bug.
foreach ($name in 'DATABASE_URL', 'DATABASE_USERNAME', 'DATABASE_PASSWORD') {
    $value = Resolve-LocalSecret $name
    if (-not $value) {
        Write-Error "$name not found in user store or .env"
        exit 1
    }
    Set-Item -Path ('Env:' + $name) -Value $value
    Write-Output ($name + ' resolved: yes (len ' + $value.Length + ')')
}

# A standalone backend does not inherit Compose's MinIO variables. Document
# generation uses this private store even when general uploads are disabled.
# Resolve the same local credentials as Compose without printing them.
$storageEndpoint = Resolve-LocalSecret 'MINIO_ENDPOINT'
$storageAccess = Resolve-LocalSecret 'MINIO_ROOT_USER'
$storageSecret = Resolve-LocalSecret 'MINIO_ROOT_PASSWORD'
if (-not $storageEndpoint -or -not $storageAccess -or -not $storageSecret) {
    Write-Error 'Local MinIO endpoint or credentials not found in user store or .env'
    exit 1
}
$env:STORAGE_ENDPOINT = $storageEndpoint
$env:STORAGE_ACCESS_KEY = $storageAccess
$env:STORAGE_SECRET_KEY = $storageSecret
Write-Output 'Local document storage resolved: yes'

# The Compose stack passes these fictional demo values to the container itself
# (infrastructure/docker-compose.yml:221-226); a standalone backend gets nothing,
# so BankTransferPaymentService#isConfigured() is false and every patient payment
# panel can only render its 503 state. Same values, same override order.
if (-not $env:APP_PAYMENT_BANK_TRANSFER_ENABLED) { $env:APP_PAYMENT_BANK_TRANSFER_ENABLED = 'true' }
if (-not $env:PAYMENT_BANK_NAME) { $env:PAYMENT_BANK_NAME = 'Vietcombank LOCAL DEMO' }
if (-not $env:PAYMENT_BANK_BIN) { $env:PAYMENT_BANK_BIN = '970436' }
if (-not $env:PAYMENT_BANK_ACCOUNT) { $env:PAYMENT_BANK_ACCOUNT = '0123456789' }
if (-not $env:PAYMENT_BANK_ACCOUNT_HOLDER) { $env:PAYMENT_BANK_ACCOUNT_HOLDER = 'HEALTHCARE DEMO' }

Set-Location 'D:\HealthCare_Project\apps\backend'
& ./mvnw spring-boot:run "-Dspring-boot.run.arguments=--spring.profiles.active=local --server.port=$Port"
