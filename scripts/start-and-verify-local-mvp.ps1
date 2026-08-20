[CmdletBinding()]
param(
    [string]$EnvFile,
    [string]$DockerPath = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
if (-not $EnvFile) { $EnvFile = Join-Path $repositoryRoot ".env" }
$composeFile = Join-Path $repositoryRoot "infrastructure\docker-compose.yml"
$verifier = Join-Path $PSScriptRoot "verify-local-mvp.ps1"

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
    $jwtSecret = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
    $aiToken = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    $ragToken = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    $environmentText = $environmentText -replace '(?m)^JWT_SECRET=.*$', "JWT_SECRET=$jwtSecret"
    $environmentText = $environmentText -replace '(?m)^AI_SERVICE_TOKEN=.*$', "AI_SERVICE_TOKEN=$aiToken"
    $environmentText = $environmentText -replace '(?m)^RAG_INGEST_TOKEN=.*$', "RAG_INGEST_TOKEN=$ragToken"
    [System.IO.File]::WriteAllText($EnvFile, $environmentText, [Text.UTF8Encoding]::new($false))
    Write-Host "Created a disposable local .env with generated JWT/AI/RAG secrets."
}

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
