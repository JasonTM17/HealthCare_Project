#!/usr/bin/env sh
# Backend test environment preflight (Phase 01, HC-04 disposition).
#
# Portable POSIX sh equivalent of scripts/check-backend-test-preflight.ps1.
# Classifies the local runtime BEFORE Maven integration tests start so a
# Docker-less machine produces one explicit BLOCKED_ENVIRONMENT verdict
# instead of hundreds of cascading Testcontainers discovery errors.
#
# Usage:
#   scripts/check-backend-test-preflight.sh
# Exit codes:
#   0 = READY               (Docker client + reachable daemon; Maven may run)
#   2 = BLOCKED_ENVIRONMENT (Docker client or daemon unavailable; skip Maven)
set -u

if ! command -v docker >/dev/null 2>&1; then
    echo "BACKEND_TEST_ENVIRONMENT=BLOCKED_ENVIRONMENT"
    echo "BACKEND_TEST_BLOCKER=docker-cli-missing"
    echo "BLOCKED_ENVIRONMENT: Docker daemon unavailable (Docker CLI was not found)."
    exit 2
fi

client_version=$(docker version --format '{{.Client.Version}}' 2>/dev/null) || true
if [ -z "$client_version" ]; then
    echo "BACKEND_TEST_ENVIRONMENT=BLOCKED_ENVIRONMENT"
    echo "BACKEND_TEST_BLOCKER=docker-cli-unavailable"
    echo "BLOCKED_ENVIRONMENT: Docker daemon unavailable (docker CLI probe failed)."
    exit 2
fi

# The daemon probe is the real gate: Testcontainers fails here, not on Maven.
server_version=$(docker info --format '{{.ServerVersion}}' 2>/dev/null) || true
if [ -z "$server_version" ]; then
    echo "BACKEND_TEST_ENVIRONMENT=BLOCKED_ENVIRONMENT"
    echo "BACKEND_TEST_BLOCKER=docker-daemon-unreachable"
    echo "BLOCKED_ENVIRONMENT: Docker daemon unavailable (docker info server probe failed). Start Docker Desktop/Engine and rerun."
    exit 2
fi

echo "BACKEND_TEST_ENVIRONMENT=READY"
echo "BACKEND_TEST_DOCKER_CLIENT=$client_version"
echo "BACKEND_TEST_DOCKER_SERVER=$server_version"
exit 0
