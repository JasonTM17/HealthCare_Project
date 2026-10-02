# Local-only helper. Process overrides and this checkout's .env take precedence
# over legacy Windows user settings. Provider keys never authorize remote chat.
param(
    [ValidateRange(1, 65535)][int]$Port = 8000,
    [string]$EnvFile = (Join-Path (Split-Path -Parent $PSScriptRoot) '.env')
)
$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot

function Resolve-Secret([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if ($null -ne $value) { return $value }
    if (Test-Path -LiteralPath $EnvFile -PathType Leaf) {
        $line = Select-String -LiteralPath $EnvFile -Pattern ('^\s*' + [regex]::Escape($Name) + '\s*=') | Select-Object -First 1
        if ($line) {
            $value = $line.Line.Substring($line.Line.IndexOf('=') + 1).Trim()
            if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            return $value
        }
    }
    return [Environment]::GetEnvironmentVariable($Name, 'User')
}

# Keys the runtime reads from the environment; names only, never values.
$names = @(
    'AI_PROVIDER', 'AI_API_KEY', 'AI_CHAT_MODEL', 'AI_EMBEDDING_MODEL', 'AI_BASE_URL',
    'AI_TIMEOUT_SECONDS', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'DEEPSEEK_BASE_URL',
    'DEEPSEEK_EMBEDDING_MODEL', 'AI_SERVICE_TOKEN', 'AI_SERVICE_RUNTIME',
    'EMBEDDING_PROVIDER', 'RAG_STORAGE_BACKEND', 'SUPABASE_DB_URL',
    'RAG_INGEST_ENABLED', 'RAG_INGEST_TOKEN',
    'AI_PUBLIC_HOSPITAL_SUPPORT_REMOTE_ENABLED', 'AI_PATIENT_CHAT_REMOTE_ENABLED',
    'AI_CHAT_REMOTE_PROVIDER_ENABLED', 'REMOTE_AI_RELEASE_HOLD',
    'REMOTE_AI_KILL_SWITCH', 'REMOTE_AI_SYNTHETIC_ONLY'
)

foreach ($name in $names) {
    $value = Resolve-Secret $name
    if ($null -ne $value) {
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}

if (-not $env:AI_PROVIDER) { $env:AI_PROVIDER = 'local' }
if (-not $env:EMBEDDING_PROVIDER) { $env:EMBEDDING_PROVIDER = 'local' }
if (-not $env:RAG_STORAGE_BACKEND) { $env:RAG_STORAGE_BACKEND = 'memory' }
if (-not $env:AI_SERVICE_RUNTIME) { $env:AI_SERVICE_RUNTIME = 'local' }
if ($env:AI_PROVIDER -in @('local', 'rule_based_triage') -and -not $env:AI_CHAT_MODEL) {
    $env:AI_CHAT_MODEL = 'local-deterministic'
}

foreach ($flag in @('AI_PUBLIC_HOSPITAL_SUPPORT_REMOTE_ENABLED', 'AI_PATIENT_CHAT_REMOTE_ENABLED', 'AI_CHAT_REMOTE_PROVIDER_ENABLED')) {
    if (-not [Environment]::GetEnvironmentVariable($flag, 'Process')) { Set-Item -Path "Env:$flag" -Value 'false' }
}
if (-not $env:REMOTE_AI_KILL_SWITCH) { $env:REMOTE_AI_KILL_SWITCH = 'true' }
if (-not $env:REMOTE_AI_RELEASE_HOLD) { $env:REMOTE_AI_RELEASE_HOLD = 'true' }
if (-not $env:REMOTE_AI_SYNTHETIC_ONLY) { $env:REMOTE_AI_SYNTHETIC_ONLY = 'true' }

if (-not $env:AI_SERVICE_TOKEN) {
    throw 'AI_SERVICE_TOKEN is required and must match the backend; use the process environment or the selected .env file.'
}
if ($env:AI_PROVIDER -eq 'deepseek' -and -not ($env:DEEPSEEK_API_KEY -or $env:AI_API_KEY)) {
    throw 'Selected DeepSeek provider requires DEEPSEEK_API_KEY or AI_API_KEY.'
}
if ($env:AI_PROVIDER -eq 'openai' -and -not $env:AI_API_KEY) {
    throw 'Selected OpenAI provider requires AI_API_KEY.'
}

$pythonPath = Join-Path $repositoryRoot 'apps/ai-service/.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf)) { $pythonPath = 'python' }
Write-Output 'Starting local AI service with authenticated configuration; values are not logged.'
Push-Location -LiteralPath (Join-Path $repositoryRoot 'apps/ai-service')
try {
    & $pythonPath -m uvicorn app.main:app --host 127.0.0.1 --port $Port --no-access-log
    $runtimeExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $runtimeExitCode
