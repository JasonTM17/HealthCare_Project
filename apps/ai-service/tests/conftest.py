"""Make the local-only auth escape hatch explicit for deterministic tests."""

import os

os.environ["AI_SERVICE_RUNTIME"] = "local"
os.environ["AI_SERVICE_ALLOW_UNAUTHENTICATED_LOCAL"] = "true"
