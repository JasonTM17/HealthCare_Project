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
    module = _module()
    combined = text + module

    assert "dockerDesktopLinuxEngine" in text
    assert "npipe:////./pipe/dockerDesktopLinuxEngine" in text
    assert "desktop status --format json" in module
    assert "WaitForExit($TimeoutMilliseconds)" in module
    assert "$process.Kill()" in module
    assert "ReadToEndAsync()" in module
    assert "$stdoutTask.Wait(1000)" in module
    assert "$stderrTask.Wait(1000)" in module
    assert "Drain both redirected pipes" in module
    assert "Invoke-DockerDesktopStatusProbe -DockerPath $dockerPath" in text
    assert "Invoke-DockerDesktopStatusProbe" in combined
    assert "Test-DockerDesktopRunning" in text
    assert "status.Status" in text
    assert "cached Docker API response" in text
    assert "MaximumRecreations" in module
    assert "Quarantines were preserved" in module
    assert "version --format 'server={{.Server.Version}}'" in text
    assert "Docker Desktop did not become healthy" in text
    assert "Wait-DockerStable" in text
    assert "Quarantine was preserved" in text
    assert "No Docker image, volume, WSL data disk, other WSL distribution, or Hibernate setting was changed." in text
    assert "-WindowStyle Hidden" in text
    assert "MinimumHostFreeBytes" in text
    assert "Assert-DockerHostCapacity" in text
    assert "docker desktop stop" in text
    assert "WaitForExit($StopTimeoutSeconds * 1000)" in text
    assert "if (Test-DockerEngine)" in text


def test_ai_settings_are_inserted_and_verified_without_exposing_secrets() -> None:
    text = (_script() + _module())

    assert "desktop disable model-runner" in text
    assert "Wait-DockerEngineReady -Seconds $TimeoutSeconds" in text
    assert "effective settings are already disabled" in text
    assert "currentAi -eq $false" in text
    assert "currentInference -eq $false" in text
    assert 'enableDockerAI\":false,"enableInference\":false' in text
    assert "EnableInference" in text
    assert "before-safe-start" in text
    assert "AI/Inference disable could not be verified" in text
    assert "supabase_service_role" not in text.lower()


@pytest.mark.skipif(POWERSHELL is None, reason="Windows PowerShell 5.1 or pwsh is unavailable")
def test_recovery_lock_rejects_a_second_launcher_without_stale_pid_state() -> None:
    with tempfile.TemporaryDirectory(prefix="docker-safe lock ") as temporary:
        lock_path = Path(temporary) / "safe-launcher.lock"
        command = f"""
$ErrorActionPreference = 'Stop'
Import-Module {_ps_quote(MODULE)} -Force
$path = {_ps_quote(lock_path)}
$first = Open-DockerRecoveryLock -Path $path
try {{
    try {{
        $second = Open-DockerRecoveryLock -Path $path
        if ($null -ne $second) {{ $second.Dispose() }}
        throw 'second lock unexpectedly acquired'
    }} catch {{
        if ($_.Exception.Message -notmatch 'already running') {{ throw }}
    }}
}} finally {{
    $first.Dispose()
}}
$third = Open-DockerRecoveryLock -Path $path
$third.Dispose()
Write-Output 'PASS'
"""
        result = _run_powershell(command)
        assert result.returncode == 0, result.stdout + result.stderr
        assert "PASS" in result.stdout


@pytest.mark.skipif(POWERSHELL is None, reason="Windows PowerShell 5.1 or pwsh is unavailable")
def test_status_probe_drains_large_cli_output_without_pipe_deadlock() -> None:
    """A noisy CLI must not make the bounded status probe appear hung."""
    powershell = Path(POWERSHELL).resolve()
    command = f"""
$ErrorActionPreference = 'Stop'
Import-Module {_ps_quote(MODULE)} -Force
$probeArgs = '-NoLogo -NoProfile -NonInteractive -Command ""$x = ''x'' * 262144; [Console]::Out.WriteLine($x); [Console]::Out.WriteLine(''STATUS'')""'
$output = Invoke-DockerDesktopStatusProbe -DockerPath {_ps_quote(powershell)} -Arguments $probeArgs -TimeoutMilliseconds 5000
if ([string]::IsNullOrWhiteSpace($output) -or $output -notmatch 'STATUS') {{ throw 'large-output status probe did not complete' }}
Write-Output 'PASS'
"""
    result = _run_powershell(command, timeout=20)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "PASS" in result.stdout


@pytest.mark.skipif(POWERSHELL is None, reason="Windows PowerShell 5.1 or pwsh is unavailable")
def test_host_capacity_check_is_fail_closed_and_can_be_explicitly_disabled() -> None:
    with tempfile.TemporaryDirectory(prefix="docker-safe capacity ") as temporary:
        command = f"""
$ErrorActionPreference = 'Stop'
Import-Module {_ps_quote(MODULE)} -Force
$path = {_ps_quote(temporary)}
Assert-DockerHostCapacity -Path $path -MinimumFreeBytes 0
try {{
    Assert-DockerHostCapacity -Path $path -MinimumFreeBytes ([long]::MaxValue)
    throw 'capacity check unexpectedly passed'
}} catch {{
    if ($_.Exception.Message -notmatch 'at least .* GiB is required before startup') {{ throw }}
}}
Write-Output 'PASS'
"""
        result = _run_powershell(command)
        assert result.returncode == 0, result.stdout + result.stderr
        assert "PASS" in result.stdout


def test_operation_order_is_stop_rotate_start_then_verify() -> None:
    text = _script()
    assert text.rindex("Assert-DockerHostCapacity -Path") < text.rindex("Open-DockerRecoveryLock -Path")
    assert text.index("Stop-DockerDesktopSafely") < text.index("Rotate-DockerRuntimeDirectories")
    assert text.index("Rotate-DockerRuntimeDirectories") < text.index("Start-Process -FilePath $desktopPath")
    assert text.index("Start-Process -FilePath $desktopPath") < text.rindex("Disable-AndVerifyDockerAi")
    assert "@('desktop', 'stop', '--timeout'" in text
    assert "Wait-DockerStopped" in text
    assert "-replace \"`0\", ''" in text
    assert "finally" in text
    assert "$recoveryLock.Dispose()" in text


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
def test_runtime_rotation_quarantines_a_late_socket_recreation() -> None:
    """A late auxiliary writer must not strand the launcher on an existing parent."""
    with tempfile.TemporaryDirectory(prefix="docker-safe late recreation ") as temporary:
        root = Path(temporary)
        command = f"""
$ErrorActionPreference = 'Stop'
Import-Module {_ps_quote(MODULE)} -Force
$root = {_ps_quote(root)}
$run = Join-Path $root 'run'
New-Item -ItemType Directory -Path $run | Out-Null
Set-Content -LiteralPath (Join-Path $run 'original.txt') -Value 'preserve-original'
$writer = Start-Job -ScriptBlock {{
    param($root, $run)
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    do {{
        $stale = @(Get-ChildItem -LiteralPath $root -Directory -Filter 'run.stale-*' -ErrorAction SilentlyContinue)
        if (($stale.Count -gt 0) -and (Test-Path -LiteralPath $run -PathType Container)) {{
            Set-Content -LiteralPath (Join-Path $run 'late.sock') -Value 'late-writer'
            return
        }}
        Start-Sleep -Milliseconds 10
    }} while ([DateTime]::UtcNow -lt $deadline)
    throw 'late writer did not observe rotation'
}} -ArgumentList $root, $run
try {{
    $rotation = Rotate-DockerRuntimeDirectory -Path $run -AllowedPaths @($run) -SettleMilliseconds 500 -MaximumRecreations 3
    $writer | Wait-Job -Timeout 15 | Out-Null
    $writerOutput = $writer | Receive-Job -ErrorAction Stop
}} finally {{
    $writer | Remove-Job -Force -ErrorAction SilentlyContinue
}}
if (@($rotation.Quarantines).Count -lt 2) {{ throw 'late recreation was not quarantined separately' }}
if (@(Get-ChildItem -LiteralPath $run -Force).Count -ne 0) {{ throw 'replacement runtime parent is not empty' }}
if ((Get-Content -Raw -LiteralPath (Join-Path $rotation.Quarantine 'original.txt')).Trim() -ne 'preserve-original') {{ throw 'original quarantine changed' }}
$lateCopy = @($rotation.Quarantines | Where-Object {{ Test-Path -LiteralPath (Join-Path $_ 'late.sock') -PathType Leaf }})
if ($lateCopy.Count -ne 1) {{ throw 'late socket copy was not preserved exactly once' }}
Write-Output 'PASS'
"""
        result = _run_powershell(command, timeout=45)
        assert result.returncode == 0, result.stdout + result.stderr
        assert "PASS" in result.stdout


@pytest.mark.skipif(POWERSHELL is None, reason="Windows PowerShell 5.1 or pwsh is unavailable")
def test_multi_path_rotation_rolls_back_in_reverse_order() -> None:
    """A failed second rotation must restore the first path without shell errors."""
    with tempfile.TemporaryDirectory(prefix="docker-safe rollback ") as temporary:
        root = Path(temporary)
        command = f"""
$ErrorActionPreference = 'Stop'
Import-Module {_ps_quote(MODULE)} -Force
$root = {_ps_quote(root)}
$run = Join-Path $root 'run'
$bad = Join-Path $root 'bad'
New-Item -ItemType Directory -Path $run | Out-Null
Set-Content -LiteralPath (Join-Path $run 'sentinel.txt') -Value 'preserve'
Set-Content -LiteralPath $bad -Value 'not-a-directory'
try {{
    Rotate-DockerRuntimeDirectories -Paths @($run, $bad) -AllowedPaths @($run, $bad) | Out-Null
    throw 'multi-path rotation unexpectedly succeeded'
}} catch {{
    if ($_.Exception.Message -match 'Select-Object.*Reverse|parameter cannot be found') {{ throw }}
}}
if (-not (Test-Path -LiteralPath (Join-Path $run 'sentinel.txt') -PathType Leaf)) {{ throw 'first path was not restored' }}
if ((Get-Content -Raw -LiteralPath (Join-Path $run 'sentinel.txt')).Trim() -ne 'preserve') {{ throw 'restored content mismatch' }}
Write-Output 'PASS'
"""
        result = _run_powershell(command)
        assert result.returncode == 0, result.stdout + result.stderr
        assert "PASS" in result.stdout


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
    if ($_.Exception.Message -notmatch 'reparse[- ]point') {{ throw }}
}}
if (-not (Test-Path -LiteralPath (Join-Path $target 'sentinel.txt') -PathType Leaf)) {{ throw 'target was touched' }}
[IO.Directory]::Delete($junction, $false)
Write-Output 'PASS'
"""
        result = _run_powershell(command)
        assert result.returncode == 0, result.stdout + result.stderr
        assert "PASS" in result.stdout


@pytest.mark.skipif(POWERSHELL is None, reason="Windows PowerShell 5.1 or pwsh is unavailable")
def test_reparse_ancestor_is_refused_without_touching_target() -> None:
    with tempfile.TemporaryDirectory(prefix="docker-safe ancestor ") as temporary:
        root = Path(temporary)
        command = f"""
$ErrorActionPreference = 'Stop'
Import-Module {_ps_quote(MODULE)} -Force
$root = {_ps_quote(root)}
$target = Join-Path $root 'target'
$ancestor = Join-Path $root 'ancestor-link'
New-Item -ItemType Directory -Path $target | Out-Null
New-Item -ItemType Directory -Path (Join-Path $target 'run') | Out-Null
Set-Content -LiteralPath (Join-Path $target 'run\\sentinel.txt') -Value 'keep'
New-Item -ItemType Junction -Path $ancestor -Target $target | Out-Null
$runtime = Join-Path $ancestor 'run'
try {{
    Rotate-DockerRuntimeDirectory -Path $runtime -AllowedPaths @($runtime) | Out-Null
    throw 'reparse ancestor was unexpectedly traversed'
}} catch {{
    if ($_.Exception.Message -notmatch 'reparse-point ancestor') {{ throw }}
}}
if (-not (Test-Path -LiteralPath (Join-Path $target 'run\\sentinel.txt') -PathType Leaf)) {{ throw 'target was touched' }}
[IO.Directory]::Delete($ancestor, $false)
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
