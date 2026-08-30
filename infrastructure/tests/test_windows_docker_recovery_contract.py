import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "start-docker-safe.ps1"
INSTALLER = ROOT / "scripts" / "install-docker-safe-launcher.ps1"
MODULE = ROOT / "scripts" / "lib" / "DockerSafeRuntime.psm1"
POWERSHELL = shutil.which("powershell.exe") or shutil.which("pwsh")


def _script() -> str:
    return SCRIPT.read_text(encoding="utf-8")


def _installer() -> str:
    return INSTALLER.read_text(encoding="utf-8")


def _module() -> str:
    return MODULE.read_text(encoding="utf-8")


def _ps_quote(value: Path | str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def _run_powershell(command: str, *, timeout: int = 60) -> subprocess.CompletedProcess[str]:
    if POWERSHELL is None:
        pytest.skip("Windows PowerShell 5.1 or pwsh is unavailable")
    return subprocess.run(
        [POWERSHELL, "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
    )


def test_recovery_rotates_only_the_two_runtime_parent_directories() -> None:
    text = _script()
    module = _module()

    assert "Join-Path $dockerRoot 'run'" in text
    assert "Join-Path ${env:LOCALAPPDATA} 'docker-secrets-engine'" in text
    assert "Rotate-DockerRuntimeDirectories -Paths $runtimeDirectories -AllowedPaths $runtimeDirectories" in text
    assert '"$leaf.stale-$stamp"' in module
    assert "Assert-ExactAllowedPath" in module


def test_recovery_preserves_docker_data_and_other_wsl_distributions() -> None:
    text = (_script() + _module()).lower()

    assert "wsl.exe --terminate docker-desktop" in text
    assert "wsl.exe --shutdown" not in text
    assert "wsl.exe --unregister" not in text
    assert "docker system prune" not in text
    assert "docker volume prune" not in text
    assert "remove-item" not in text
    assert "powercfg" not in text
    assert "wsl data disk" in text


def test_recovery_waits_for_a_real_local_engine_response_and_stability_gate() -> None:
    text = _script()

    assert "dockerDesktopLinuxEngine" in text
    assert "npipe:////./pipe/dockerDesktopLinuxEngine" in text
    assert "version --format 'server={{.Server.Version}}'" in text
    assert "Docker Desktop did not become healthy" in text
    assert "Wait-DockerStable" in text
    assert "Quarantine was preserved" in text
    assert "No Docker image, volume, WSL data disk, other WSL distribution, or Hibernate setting was changed." in text


def test_ai_settings_are_inserted_and_verified_without_exposing_secrets() -> None:
    text = (_script() + _module())

    assert "desktop disable model-runner" in text
    assert 'enableDockerAI\":false,"enableInference\":false' in text
    assert "EnableInference" in text
    assert "before-safe-start" in text
    assert "AI/Inference disable could not be verified" in text
    assert "supabase_service_role" not in text.lower()


def test_operation_order_is_stop_rotate_start_then_verify() -> None:
    text = _script()
    assert text.index("Stop-DockerDesktopSafely") < text.index("Rotate-DockerRuntimeDirectories")
    assert text.index("Rotate-DockerRuntimeDirectories") < text.index("Start-Process -FilePath $desktopPath")
    assert text.index("Start-Process -FilePath $desktopPath") < text.rindex("Disable-AndVerifyDockerAi")
    assert "desktop stop --timeout $StopTimeoutSeconds" in text
    assert "Wait-DockerStopped" in text


@pytest.mark.skipif(POWERSHELL is None, reason="Windows PowerShell 5.1 or pwsh is unavailable")
def test_runtime_rotation_and_store_mutation_behave_on_a_fixture() -> None:
    with tempfile.TemporaryDirectory(prefix="docker-safe fixture ") as temporary:
        root = Path(temporary)
        command = f"""
$ErrorActionPreference = 'Stop'
Import-Module {_ps_quote(MODULE)} -Force
$root = {_ps_quote(root)}
$run = Join-Path $root 'run'
New-Item -ItemType Directory -Path $run | Out-Null
Set-Content -LiteralPath (Join-Path $run 'sentinel.txt') -Value 'preserve'
$rotation = Rotate-DockerRuntimeDirectory -Path $run -AllowedPaths @($run)
$quarantine = $rotation.Quarantine
if (-not (Test-Path -LiteralPath $run -PathType Container)) {{ throw 'runtime directory was not recreated' }}
if ((Get-Content -Raw -LiteralPath (Join-Path $quarantine 'sentinel.txt')).Trim() -ne 'preserve') {{ throw 'quarantine content mismatch' }}
$store = Join-Path $root 'settings.json'
Set-Content -LiteralPath $store -Value '{{"Unknown":{{"x":1}}}}'
[void](Set-DockerAiStore -SettingsPath $store)
$settings = Get-Content -Raw -LiteralPath $store | ConvertFrom-Json
if (($settings.EnableDockerAI -ne $false) -or ($settings.EnableInference -ne $false) -or ($settings.Unknown.x -ne 1)) {{ throw 'settings mutation mismatch' }}
[ordered]@{{ quarantine = $quarantine; ai = $settings.EnableDockerAI; inference = $settings.EnableInference }} | ConvertTo-Json -Compress
"""
        result = _run_powershell(command)
        assert result.returncode == 0, result.stdout + result.stderr
        payload = json.loads(result.stdout.strip().splitlines()[-1])
        assert payload["ai"] is False
        assert payload["inference"] is False


@pytest.mark.skipif(POWERSHELL is None, reason="Windows PowerShell 5.1 or pwsh is unavailable")
def test_reparse_parent_is_refused_without_touching_target() -> None:
    with tempfile.TemporaryDirectory(prefix="docker-safe reparse ") as temporary:
        root = Path(temporary)
        command = f"""
$ErrorActionPreference = 'Stop'
Import-Module {_ps_quote(MODULE)} -Force
$root = {_ps_quote(root)}
$target = Join-Path $root 'target'
$junction = Join-Path $root 'run'
New-Item -ItemType Directory -Path $target | Out-Null
Set-Content -LiteralPath (Join-Path $target 'sentinel.txt') -Value 'keep'
New-Item -ItemType Junction -Path $junction -Target $target | Out-Null
try {{
    Rotate-DockerRuntimeDirectory -Path $junction -AllowedPaths @($junction) | Out-Null
    throw 'reparse parent was unexpectedly changed'
}} catch {{
    if ($_.Exception.Message -notmatch 'reparse point') {{ throw }}
}}
if (-not (Test-Path -LiteralPath (Join-Path $target 'sentinel.txt') -PathType Leaf)) {{ throw 'target was touched' }}
[IO.Directory]::Delete($junction, $false)
Write-Output 'PASS'
"""
        result = _run_powershell(command)
        assert result.returncode == 0, result.stdout + result.stderr
        assert "PASS" in result.stdout


@pytest.mark.skipif(POWERSHELL is None, reason="Windows PowerShell 5.1 or pwsh is unavailable")
def test_installer_is_idempotent_opt_in_and_restorable() -> None:
    with tempfile.TemporaryDirectory(prefix="docker-safe installer ") as temporary:
        root = Path(temporary)
        shortcut = root / "Docker Desktop.lnk"
        state = root / "state.json"
        run_key = "HKCU:\\Software\\DockerSafeLauncherFixture_" + next(tempfile._get_candidate_names())
        desktop = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Docker" / "Docker" / "Docker Desktop.exe"
        powershell_path = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe"
        command = f"""
$ErrorActionPreference = 'Stop'
$shell = New-Object -ComObject WScript.Shell
$shortcutPath = {_ps_quote(shortcut)}
$link = $shell.CreateShortcut($shortcutPath)
$link.TargetPath = 'C:\\original-docker.exe'
$link.Arguments = '--original'
$link.Save()
New-Item -Path {_ps_quote(run_key)} -Force | Out-Null
New-ItemProperty -Path {_ps_quote(run_key)} -Name 'Docker Desktop' -Value 'C:\\original-run.exe' -PropertyType String -Force | Out-Null
$common = @{{ '-ShortcutPath' = {_ps_quote(shortcut)}; '-RunKeyPath' = {_ps_quote(run_key)}; '-RunStatePath' = {_ps_quote(state)}; '-DesktopPath' = {_ps_quote(desktop)}; '-PowerShellPath' = {_ps_quote(powershell_path)} }}
& {_ps_quote(INSTALLER)} @common
$unchanged = (Get-ItemProperty -Path {_ps_quote(run_key)} -Name 'Docker Desktop').'Docker Desktop'
if ($unchanged -ne 'C:\\original-run.exe') {{ throw 'default installer changed AutoStart' }}
& {_ps_quote(INSTALLER)} @common -InstallAutoStart
& {_ps_quote(INSTALLER)} @common -InstallAutoStart
$installed = (Get-ItemProperty -Path {_ps_quote(run_key)} -Name 'Docker Desktop').'Docker Desktop'
if ($installed -notmatch 'start-docker-safe.ps1') {{ throw 'safe AutoStart was not installed' }}
& {_ps_quote(INSTALLER)} @common -Restore
$restored = (Get-ItemProperty -Path {_ps_quote(run_key)} -Name 'Docker Desktop').'Docker Desktop'
$link = $shell.CreateShortcut($shortcutPath)
if (($restored -ne 'C:\\original-run.exe') -or ($link.TargetPath -ne 'C:\\original-docker.exe') -or ($link.Arguments -ne '--original')) {{ throw 'restore mismatch' }}
Remove-Item -LiteralPath {_ps_quote(run_key)} -Recurse -Force
Write-Output 'PASS'
"""
        result = _run_powershell(command, timeout=90)
        assert result.returncode == 0, result.stdout + result.stderr
        assert "PASS" in result.stdout


@pytest.mark.skipif(POWERSHELL is None, reason="Windows PowerShell 5.1 or pwsh is unavailable")
def test_scripts_parse_with_windows_powershell() -> None:
    files = [MODULE, SCRIPT, INSTALLER]
    paths = ",".join(_ps_quote(path) for path in files)
    command = f"""
$ErrorActionPreference = 'Stop'
foreach ($file in @({paths})) {{
    $tokens = $null
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($file, [ref]$tokens, [ref]$errors)
    if ($errors.Count) {{ throw ($errors | Out-String) }}
}}
Write-Output 'PASS'
"""
    result = _run_powershell(command)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "PASS" in result.stdout
