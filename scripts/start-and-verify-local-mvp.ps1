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
    $bytes = New-Object byte[] $ByteCount
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

function Test-IsWindowsHost {
    return [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform(
        [System.Runtime.InteropServices.OSPlatform]::Windows
    )
}

if (-not (Test-Path -LiteralPath $DockerPath -PathType Leaf)) {
    $command = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $command) { throw "Docker CLI was not found" }
    $DockerPath = $command.Source
}

if (Test-IsWindowsHost) {
    $desktopStatus = & $DockerPath desktop status 2>&1
    if ($LASTEXITCODE -ne 0 -or ($desktopStatus -join " ") -notmatch "running") {
        throw "Docker Desktop engine is not running. Enable WSL 2/virtualization, restart Windows, then open Docker Desktop."
    }
} else {
    & $DockerPath info --format '{{.ServerVersion}}' | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker engine is not running or is not reachable by the Docker CLI."
    }
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
$environmentChanged = $false
if ($prepareEnvironment) {
    $jwtSecret = Get-EnvironmentValue $environmentText "JWT_SECRET"
    if ([string]::IsNullOrWhiteSpace($jwtSecret) -or $jwtSecret -eq "change-me-use-a-256-bit-secret-key-for-production-environment-please") {
        $environmentText = Set-EnvironmentValue $environmentText "JWT_SECRET" (New-DisposableSecret 48)
        $environmentChanged = $true
    }
    $aiToken = Get-EnvironmentValue $environmentText "AI_SERVICE_TOKEN"
    if ([string]::IsNullOrWhiteSpace($aiToken) -or $aiToken -eq "local-development-token-not-for-production") {
        $environmentText = Set-EnvironmentValue $environmentText "AI_SERVICE_TOKEN" (New-DisposableSecret 32)
        $environmentChanged = $true
    }
    $ragToken = Get-EnvironmentValue $environmentText "RAG_INGEST_TOKEN"
    if ([string]::IsNullOrWhiteSpace($ragToken) -or $ragToken -eq "local-rag-ingest-token-not-for-production") {
        $ragToken = New-DisposableSecret 32
        $environmentText = Set-EnvironmentValue $environmentText "RAG_INGEST_TOKEN" $ragToken
        $environmentChanged = $true
    }

    # This explicit local-only preparation enables the protected catalog sync.
    # Ordinary Compose remains fail-closed when no environment opts in.
    $environmentText = Set-EnvironmentValue $environmentText "RAG_INGEST_ENABLED" "true"
    $environmentText = Set-EnvironmentValue $environmentText "AI_RAG_INGEST_ENABLED" "true"
    $environmentText = Set-EnvironmentValue $environmentText "AI_RAG_INGEST_TOKEN" $ragToken

    # The disposable full-MVP fixture includes MinIO and the private
    # attachment-scanner sidecar, so opt both generic and consultation storage
    # in explicitly. The verifier exercises the generic /files/upload path,
    # while the patient flow uses consultation storage. `.env.example` keeps
    # both flags false for ordinary development; never mutate an operator-
    # provided environment outside this preparation branch.
    $environmentText = Set-EnvironmentValue $environmentText "STORAGE_UPLOAD_ENABLED" "true"
    $environmentText = Set-EnvironmentValue $environmentText "STORAGE_CONSULTATION_ENABLED" "true"

    # The live role-based browser gate exercises the persisted SSE chat
    # contract. Keep Compose fail-closed by default, but enable chunked delivery
    # in this disposable full-MVP fixture so the UI and direct live contract
    # observe the same capability.
    $environmentText = Set-EnvironmentValue $environmentText "AI_CHAT_CHUNKED_ENABLED" "true"
} else {
    $ragEnabled = Get-EnvironmentValue $environmentText "RAG_INGEST_ENABLED"
    $ragToken = Get-EnvironmentValue $environmentText "RAG_INGEST_TOKEN"
    if ($ragEnabled -ne "true" -or [string]::IsNullOrWhiteSpace($ragToken)) {
        throw "Existing .env does not opt into protected RAG catalog sync. Review it, then run '$PSScriptRoot\start-and-verify-local-mvp.ps1 -PrepareOnly' to prepare a disposable local MVP environment."
    }
}

# Compose is intentionally fail-closed. Repair missing disposable values even
# when an existing .env is reused, so a previously prepared checkout does not
# fail later at `docker compose config` merely because new required secrets
# were added. Never replace an operator-provided value.
foreach ($requiredSecret in @(
        @{ Key = "APP_MAIL_OUTBOX_ENCRYPTION_KEY"; Bytes = 32 },
        @{ Key = "BACKEND_BFF_SERVICE_TOKEN"; Bytes = 32 },
        @{ Key = "STORAGE_AV_SERVICE_TOKEN"; Bytes = 32 }
    )) {
    $existingSecret = Get-EnvironmentValue $environmentText $requiredSecret.Key
    if ([string]::IsNullOrWhiteSpace($existingSecret)) {
        $environmentText = Set-EnvironmentValue $environmentText $requiredSecret.Key (New-DisposableSecret $requiredSecret.Bytes)
        $environmentChanged = $true
    }
}

if ($prepareEnvironment -or $environmentChanged) {
    [System.IO.File]::WriteAllText($EnvFile, $environmentText, [Text.UTF8Encoding]::new($false))
    if ($prepareEnvironment) {
        Write-Host "Prepared local .env for the full MVP with generated missing JWT/AI/RAG secrets."
    } else {
        Write-Host "Added missing disposable Compose secrets to the existing local .env."
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

    $seedContainerOutput = & $DockerPath compose --env-file $EnvFile -f $composeFile ps --all -q local-seed 2>&1
    $seedContainerExit = $LASTEXITCODE
    $seedContainerId = ($seedContainerOutput | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
    if ($seedContainerExit -ne 0 -or [string]::IsNullOrWhiteSpace($seedContainerId)) {
        throw "Unable to resolve the local-seed container for the current Compose project"
    }

    $seedExit = (& $DockerPath wait $seedContainerId 2>&1 | Select-Object -Last 1).Trim()
    if ($seedExit -ne "0") {
        & $DockerPath compose --env-file $EnvFile -f $composeFile logs --tail 120 local-seed
        throw "Local seed container exited with code $seedExit"
    }

    $verifierParameters = @{ DockerPath = $DockerPath; ExpectedRevision = $buildRevision; ComposeFile = $composeFile; EnvFile = $EnvFile }
    $readinessParameters = @{ DockerPath = $DockerPath; ExpectedRevision = $buildRevision; ComposeFile = $composeFile; EnvFile = $EnvFile; ReadinessOnly = $true }
    $lastError = $null
    $readinessPassed = $false
    for ($attempt = 1; $attempt -le 45; $attempt++) {
        try {
            & $verifier @readinessParameters
            if ($LASTEXITCODE -ne 0) { throw "Verifier returned exit code $LASTEXITCODE" }
            $readinessPassed = $true
            break
        } catch {
            $lastError = $_
            Start-Sleep -Seconds 2
        }
    }
    if (-not $readinessPassed) {
        throw "Stack did not become ready within 90 seconds: $($lastError.Exception.Message)"
    }

    & $verifier @verifierParameters
    if ($LASTEXITCODE -ne 0) { throw "Verifier returned exit code $LASTEXITCODE" }
    return
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
