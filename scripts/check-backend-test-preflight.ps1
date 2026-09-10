# Backend test environment preflight (Phase 01, HC-04 disposition).
#
# Classifies the local runtime BEFORE Maven integration tests start so a
# Docker-less machine produces one explicit BLOCKED_ENVIRONMENT verdict
# instead of hundreds of cascading Testcontainers discovery errors.
#
# Usage:
#   powershell -NoLogo -NoProfile -File scripts/check-backend-test-preflight.ps1
#   scripts/check-backend-test-preflight.sh   (portable POSIX sh equivalent)
# Exit codes:
#   0 = READY           (Docker client + reachable daemon; Maven may run)
#   2 = BLOCKED_ENVIRONMENT (Docker client or daemon unavailable; skip Maven)
#   3 = PREFLIGHT_ERROR (the preflight itself failed unexpectedly)

$ErrorActionPreference = 'Stop'

$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($null -eq $docker) {
    Write-Output "BACKEND_TEST_ENVIRONMENT=BLOCKED_ENVIRONMENT"
    Write-Output "BACKEND_TEST_BLOCKER=docker-cli-missing"
    Write-Output "BLOCKED_ENVIRONMENT: Docker daemon unavailable (Docker CLI was not found)."
    exit 2
}

# docker writes real diagnostics to stderr (for example when the daemon is
# down). Under Windows PowerShell 5.1, redirecting native stderr while
# $ErrorActionPreference is 'Stop' raises a terminating NativeCommandError,
# which would crash this preflight with an unclassified exit 1 exactly when it
# must classify BLOCKED_ENVIRONMENT. Relax the preference around the probes so
# the exit code stays the single source of truth.
$previousPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    $clientVersion = (@(& docker version --format '{{.Client.Version}}' 2>$null) -join [Environment]::NewLine).Trim()
    $clientExit = $LASTEXITCODE
    # The daemon probe is the real gate: Testcontainers fails here, not on Maven.
    $serverInfo = (@(& docker info --format '{{.ServerVersion}}' 2>$null) -join [Environment]::NewLine).Trim()
    $serverExit = $LASTEXITCODE
} finally {
    $ErrorActionPreference = $previousPreference
}

if ($clientExit -ne 0 -or [string]::IsNullOrWhiteSpace($clientVersion)) {
    Write-Output "BACKEND_TEST_ENVIRONMENT=BLOCKED_ENVIRONMENT"
    Write-Output "BACKEND_TEST_BLOCKER=docker-cli-unavailable"
    Write-Output "BLOCKED_ENVIRONMENT: Docker daemon unavailable (docker CLI probe failed)."
    exit 2
}

if ($serverExit -ne 0 -or [string]::IsNullOrWhiteSpace($serverInfo)) {
    Write-Output "BACKEND_TEST_ENVIRONMENT=BLOCKED_ENVIRONMENT"
    Write-Output "BACKEND_TEST_BLOCKER=docker-daemon-unreachable"
    Write-Output "BLOCKED_ENVIRONMENT: Docker daemon unavailable (docker info server probe failed). Start Docker Desktop/Engine and rerun."
    exit 2
}

Write-Output "BACKEND_TEST_ENVIRONMENT=READY"
Write-Output "BACKEND_TEST_DOCKER_CLIENT=$clientVersion"
Write-Output "BACKEND_TEST_DOCKER_SERVER=$serverInfo"
exit 0
