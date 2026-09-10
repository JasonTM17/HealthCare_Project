from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]

PREFLIGHT_SCRIPTS = (
    "check-backend-test-preflight.ps1",
    "check-backend-test-preflight.sh",
)


def _preflight_script(name: str) -> str:
    return (ROOT / "scripts" / name).read_text(encoding="utf-8")


def test_backend_test_preflight_exists_for_powershell_and_posix_sh() -> None:
    for name in PREFLIGHT_SCRIPTS:
        assert (ROOT / "scripts" / name).is_file(), name


def test_backend_test_preflight_classifies_docker_absence_as_blocked_environment() -> None:
    # One explicit classified verdict instead of hundreds of cascading
    # Testcontainers discovery errors.
    for name in PREFLIGHT_SCRIPTS:
        script = _preflight_script(name)
        assert "BACKEND_TEST_ENVIRONMENT=BLOCKED_ENVIRONMENT" in script, name
        assert "BACKEND_TEST_BLOCKER=docker-cli-missing" in script, name
        assert "BACKEND_TEST_BLOCKER=docker-daemon-unreachable" in script, name
        assert "BLOCKED_ENVIRONMENT: Docker daemon unavailable" in script, name
        # A non-zero exit must stop Maven orchestration before it starts.
        assert "exit 2" in script, name


def test_backend_test_preflight_gates_on_the_docker_server_not_just_the_cli() -> None:
    # `docker version --format '{{.Client.Version}}'` can succeed without a
    # daemon; only the server probe classifies Testcontainers readiness.
    for name in PREFLIGHT_SCRIPTS:
        script = _preflight_script(name)
        assert "docker info" in script, name
        assert "{{.ServerVersion}}" in script, name
        ready_line = script.index("BACKEND_TEST_ENVIRONMENT=READY")
        daemon_probe = script.index("docker info")
        assert daemon_probe < ready_line, name


def test_powershell_preflight_survives_native_stderr_under_strict_mode() -> None:
    # Windows PowerShell 5.1 turns native stderr into a terminating
    # NativeCommandError when $ErrorActionPreference is Stop; the daemon-down
    # probe would then crash with an unclassified exit 1 instead of exit 2.
    script = _preflight_script("check-backend-test-preflight.ps1")
    assert "$ErrorActionPreference = 'Stop'" in script
    relaxed_probe = script.index("$ErrorActionPreference = 'Continue'")
    daemon_probe = script.index("docker info")
    assert relaxed_probe < daemon_probe
