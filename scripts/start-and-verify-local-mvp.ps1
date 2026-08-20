[CmdletBinding()]
param(
    [string]$EnvFile,
    [string]$DockerPath = "C:\Program Files\Docker\Docker\resources\bin\docker.exe",
    [switch]$PrepareOnly
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
if (-not $EnvFile) { $EnvFile = Join-Path $repositoryRoot ".env" }
if (-not [IO.Path]::IsPathRooted($EnvFile)) { $EnvFile = Join-Path $repositoryRoot $EnvFile }
$EnvFile = [IO.Path]::GetFullPath($EnvFile)
$verifier = Join-Path $PSScriptRoot "verify-local-mvp.ps1"
. (Join-Path $PSScriptRoot "local-mvp-provenance.ps1")

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

$environmentAlreadyExists = Test-Path -LiteralPath $EnvFile -PathType Leaf
if (-not $environmentAlreadyExists) {
    $exampleEnv = Join-Path $repositoryRoot ".env.example"
    if (-not (Test-Path -LiteralPath $exampleEnv -PathType Leaf)) { throw "Missing .env.example" }
    $environmentText = [System.IO.File]::ReadAllText($exampleEnv)
} else {
    $environmentText = [System.IO.File]::ReadAllText($EnvFile)
}

$prepareEnvironment = -not $environmentAlreadyExists -or $PrepareOnly
if ($prepareEnvironment) {
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

    # This explicit local-only preparation enables the protected catalog sync.
    # Ordinary Compose remains fail-closed when no environment opts in.
    $environmentText = Set-EnvironmentValue $environmentText "RAG_INGEST_ENABLED" "true"
    $environmentText = Set-EnvironmentValue $environmentText "AI_RAG_INGEST_ENABLED" "true"
    $environmentText = Set-EnvironmentValue $environmentText "AI_RAG_INGEST_TOKEN" $ragToken
    [System.IO.File]::WriteAllText($EnvFile, $environmentText, [Text.UTF8Encoding]::new($false))
    Write-Host "Prepared local .env for the full MVP with generated missing JWT/AI/RAG secrets."
} else {
    $ragEnabled = Get-EnvironmentValue $environmentText "RAG_INGEST_ENABLED"
    $ragToken = Get-EnvironmentValue $environmentText "RAG_INGEST_TOKEN"
    if ($ragEnabled -ne "true" -or [string]::IsNullOrWhiteSpace($ragToken)) {
        throw "Existing .env does not opt into protected RAG catalog sync. Review it, then run '$PSScriptRoot\start-and-verify-local-mvp.ps1 -PrepareOnly' to prepare a disposable local MVP environment."
    }
}

if ($PrepareOnly) { return }

Assert-CleanBuildContext -RepositoryRoot $repositoryRoot
$buildRevision = Get-SourceRevision -RepositoryRoot $repositoryRoot
Assert-ExpectedRevision -Revision $buildRevision
$previousBuildRevision = $env:BUILD_VCS_REF
$hadBuildRevision = Test-Path Env:\BUILD_VCS_REF
$env:BUILD_VCS_REF = $buildRevision
$buildSnapshot = $null
$locationPushed = $false

try {
    $buildSnapshot = New-ImmutableBuildSnapshot -RepositoryRoot $repositoryRoot -Revision $buildRevision
    $composeFile = Join-Path (Join-Path $buildSnapshot "infrastructure") "docker-compose.yml"
    Push-Location $buildSnapshot
    $locationPushed = $true

    & $DockerPath compose --env-file $EnvFile -f $composeFile config --quiet
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose configuration is invalid" }

    & $DockerPath compose --env-file $EnvFile -f $composeFile up --build -d
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed to start the stack" }
    Assert-CleanBuildContext -RepositoryRoot $repositoryRoot
    Assert-SourceRevisionMatches -RepositoryRoot $repositoryRoot -ExpectedRevision $buildRevision

    $seedExit = (& $DockerPath wait healthcare-local-seed 2>&1 | Select-Object -Last 1).Trim()
    if ($seedExit -ne "0") {
        & $DockerPath compose --env-file $EnvFile -f $composeFile logs --tail 120 local-seed
        throw "Local seed container exited with code $seedExit"
    }

    $lastError = $null
    for ($attempt = 1; $attempt -le 45; $attempt++) {
        try {
            $verifierParameters = @{ DockerPath = $DockerPath; ExpectedRevision = $buildRevision }
            & $verifier @verifierParameters
            if ($LASTEXITCODE -ne 0) { throw "Verifier returned exit code $LASTEXITCODE" }
            return
        } catch {
            $lastError = $_
            Start-Sleep -Seconds 2
        }
    }
    throw "Stack did not pass verification within 90 seconds: $($lastError.Exception.Message)"
} finally {
    try {
        if ($locationPushed) {
            Pop-Location
        }
        if ($buildSnapshot) {
            Remove-ImmutableBuildSnapshot -RepositoryRoot $repositoryRoot -SnapshotRoot $buildSnapshot
        }
    } finally {
        if ($hadBuildRevision) {
            $env:BUILD_VCS_REF = $previousBuildRevision
        } else {
            Remove-Item Env:\BUILD_VCS_REF -ErrorAction SilentlyContinue
        }
    }
}
