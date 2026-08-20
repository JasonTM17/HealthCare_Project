[CmdletBinding()]
param(
    [string]$EnvFile,
    [string]$DockerPath = "C:\Program Files\Docker\Docker\resources\bin\docker.exe",
    [switch]$PrepareOnly
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
if (-not $EnvFile) { $EnvFile = Join-Path $repositoryRoot ".env" }
$composeFile = Join-Path $repositoryRoot "infrastructure\docker-compose.yml"
$verifier = Join-Path $PSScriptRoot "verify-local-mvp.ps1"

function Set-EnvironmentValue {
    param(
        [string]$Content,
        [string]$Key,
        [string]$Value
    )

    $pattern = "(?m)^$([regex]::Escape($Key))=.*$"
    $replacement = "$Key=$Value"
    if ([regex]::IsMatch($Content, $pattern)) {
        return [regex]::Replace($Content, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $replacement })
    }

    return "$($Content.TrimEnd())$([Environment]::NewLine)$replacement$([Environment]::NewLine)"
}

function Get-EnvironmentValue {
    param(
        [string]$Content,
        [string]$Key
    )

    $match = [regex]::Match($Content, "(?m)^$([regex]::Escape($Key))=(.*)$")
    if (-not $match.Success) { return $null }
    return $match.Groups[1].Value.Trim()
}

function New-DisposableSecret([int]$ByteCount) {
    return [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes($ByteCount))
}

if (-not (Test-Path -LiteralPath $DockerPath -PathType Leaf)) {
    $command = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $command) { throw "Docker CLI was not found" }
    $DockerPath = $command.Source
}

$desktopStatus = & $DockerPath desktop status 2>&1
if ($LASTEXITCODE -ne 0 -or ($desktopStatus -join " ") -notmatch "running") {
    throw "Docker Desktop engine is not running. Enable WSL 2/virtualization, restart Windows, then open Docker Desktop."
}

if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) {
    $exampleEnv = Join-Path $repositoryRoot ".env.example"
    if (-not (Test-Path -LiteralPath $exampleEnv -PathType Leaf)) { throw "Missing .env.example" }
    $environmentText = [System.IO.File]::ReadAllText($exampleEnv)
} else {
    $environmentText = [System.IO.File]::ReadAllText($EnvFile)
}

$jwtSecret = Get-EnvironmentValue $environmentText "JWT_SECRET"
if ([string]::IsNullOrWhiteSpace($jwtSecret) -or $jwtSecret -eq "change-me-use-a-256-bit-secret-key-for-production-environment-please") {
    $environmentText = Set-EnvironmentValue $environmentText "JWT_SECRET" (New-DisposableSecret 48)
}
$aiToken = Get-EnvironmentValue $environmentText "AI_SERVICE_TOKEN"
if ([string]::IsNullOrWhiteSpace($aiToken) -or $aiToken -eq "local-development-token-not-for-production") {
    $environmentText = Set-EnvironmentValue $environmentText "AI_SERVICE_TOKEN" (New-DisposableSecret 32)
}
$ragToken = Get-EnvironmentValue $environmentText "RAG_INGEST_TOKEN"
if ([string]::IsNullOrWhiteSpace($ragToken)) {
    $ragToken = New-DisposableSecret 32
    $environmentText = Set-EnvironmentValue $environmentText "RAG_INGEST_TOKEN" $ragToken
}

# This helper proves the complete local MVP, including the protected catalog sync.
# Compose itself remains fail-closed unless this local-only workflow explicitly enables it.
$environmentText = Set-EnvironmentValue $environmentText "RAG_INGEST_ENABLED" "true"
$environmentText = Set-EnvironmentValue $environmentText "AI_RAG_INGEST_ENABLED" "true"
$environmentText = Set-EnvironmentValue $environmentText "AI_RAG_INGEST_TOKEN" $ragToken
[System.IO.File]::WriteAllText($EnvFile, $environmentText, [Text.UTF8Encoding]::new($false))
Write-Host "Prepared local .env for the full MVP with generated missing JWT/AI/RAG secrets."

if ($PrepareOnly) { return }

Push-Location $repositoryRoot
try {
    & $DockerPath compose --env-file $EnvFile -f $composeFile config --quiet
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose configuration is invalid" }

    & $DockerPath compose --env-file $EnvFile -f $composeFile up --build -d
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed to start the stack" }

    $seedExit = (& $DockerPath wait healthcare-local-seed 2>&1 | Select-Object -Last 1).Trim()
    if ($seedExit -ne "0") {
        & $DockerPath compose --env-file $EnvFile -f $composeFile logs --tail 120 local-seed
        throw "Local seed container exited with code $seedExit"
    }

    $lastError = $null
    for ($attempt = 1; $attempt -le 45; $attempt++) {
        try {
            & $verifier
            if ($LASTEXITCODE -ne 0) { throw "Verifier returned exit code $LASTEXITCODE" }
            return
        } catch {
            $lastError = $_
            Start-Sleep -Seconds 2
        }
    }
    throw "Stack did not pass verification within 90 seconds: $($lastError.Exception.Message)"
} finally {
    Pop-Location
}
