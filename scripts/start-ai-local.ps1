# Local-only helper: boots the FastAPI ai-service on :8000 with credentials
# resolved from the Windows user store first, then the project .env. Values
# are injected into the child process and never printed.
$ErrorActionPreference = 'Stop'

function Resolve-Secret([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name, 'User')
    if (-not $value -and (Test-Path 'D:\HealthCare_Project\.env')) {
        $line = Select-String -Path 'D:\HealthCare_Project\.env' -Pattern ('^' + [regex]::Escape($Name) + '=') | Select-Object -First 1
        if ($line) { $value = $line.Line.Substring($Name.Length + 1).Trim() }
    }
    return $value
}

# Keys the runtime reads from the environment; names only, never values.
$names = @(
    'AI_PROVIDER',
    'DEEPSEEK_API_KEY',
    'AI_SERVICE_TOKEN',
    'EMBEDDING_PROVIDER',
    'RAG_STORAGE_BACKEND',
    'SUPABASE_DB_URL'
)

$missing = @()
foreach ($name in $names) {
    $value = Resolve-Secret $name
    if ($value) {
        Set-Item -Path "Env:$name" -Value $value
        Write-Output ("{0} resolved: yes (len {1})" -f $name, $value.Length)
    } else {
        $missing += $name
        Write-Output ("{0} resolved: no" -f $name)
    }
}

if (-not $env:AI_PROVIDER) { $env:AI_PROVIDER = 'deepseek' }
if (-not $env:EMBEDDING_PROVIDER) { $env:EMBEDDING_PROVIDER = 'local' }
# The public hospital-support route refuses remote egress unless this flag is
# explicitly enabled; without it the chatbot degrades to canned answers.
$env:AI_PUBLIC_HOSPITAL_SUPPORT_REMOTE_ENABLED = 'true'

# The patient-chat remote path additionally sits behind an operator release
# hold. Forward the opt-in flags only when the operator (or .env) provides
# them; leaving them unset keeps the hold closed.
foreach ($optInName in @('REMOTE_AI_RELEASE_HOLD', 'AI_PATIENT_CHAT_REMOTE_ENABLED')) {
    $optInValue = Resolve-Secret $optInName
    if ($optInValue) {
        Set-Item -Path "Env:$optInName" -Value $optInValue
        Write-Output ("{0} forwarded: yes (len {1})" -f $optInName, $optInValue.Length)
    } else {
        Write-Output ("{0} forwarded: no (patient-chat remote stays held)" -f $optInName)
    }
}

if (-not (Resolve-Secret 'DEEPSEEK_API_KEY')) {
    Write-Error 'DEEPSEEK_API_KEY not found in user store or .env; DeepSeek chat cannot start'
    exit 1
}

Set-Location 'D:\HealthCare_Project\apps\ai-service'
if (Test-Path '.venv\Scripts\python.exe') {
    & .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
} else {
    & python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
}
