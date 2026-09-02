[CmdletBinding()]
param(
    [ValidateRange(30, 900)][int]$TimeoutSeconds = 360,
    [ValidateRange(10, 120)][int]$StopTimeoutSeconds = 45,
    [ValidateRange(0, 120)][int]$StabilitySeconds = 20,
    [ValidateRange(0, 64GB)][long]$MinimumHostFreeBytes = 2GB,
    [switch]$Restart,
    [switch]$KeepDockerAI
)

$ErrorActionPreference = 'Stop'

if (-not [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform(
        [System.Runtime.InteropServices.OSPlatform]::Windows)) {
    throw 'This recovery launcher is only for Windows Docker Desktop.'
}

$runtimeModule = Join-Path $PSScriptRoot 'lib\DockerSafeRuntime.psm1'
if (-not (Test-Path -LiteralPath $runtimeModule -PathType Leaf)) {
    throw "Docker recovery module was not found: $runtimeModule"
}
Import-Module $runtimeModule -Force -DisableNameChecking

$dockerCommand = Get-Command docker.exe -ErrorAction SilentlyContinue
if (-not $dockerCommand) {
    $dockerPath = Join-Path ${env:ProgramFiles} 'Docker\Docker\resources\bin\docker.exe'
    if (-not (Test-Path -LiteralPath $dockerPath -PathType Leaf)) {
        throw 'Docker CLI was not found.'
    }
} else {
    $dockerPath = $dockerCommand.Source
}
$wslCommand = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wslCommand) {
    throw 'WSL CLI was not found.'
}
$wslPath = $wslCommand.Source

$desktopPath = Join-Path ${env:ProgramFiles} 'Docker\Docker\Docker Desktop.exe'
if (-not (Test-Path -LiteralPath $desktopPath -PathType Leaf)) {
    throw "Docker Desktop was not found at $desktopPath."
}

$dockerRoot = Join-Path ${env:LOCALAPPDATA} 'Docker'
$runtimeDirectories = @(
    (Join-Path $dockerRoot 'run'),
    (Join-Path ${env:LOCALAPPDATA} 'docker-secrets-engine')
)
$enginePipe = '\\.\pipe\dockerDesktopLinuxEngine'
$localDockerHost = 'npipe:////./pipe/dockerDesktopLinuxEngine'
$settingsPath = Join-Path ${env:APPDATA} 'Docker\settings-store.json'
$recoveryLockPath = Join-Path $dockerRoot 'safe-launcher.lock'
$env:DOCKER_HOST = $localDockerHost

function Get-RemainingTimeoutMilliseconds {
    param(
        [Parameter(Mandatory)][DateTime]$Deadline,
        [ValidateRange(1, 600000)][int]$Maximum = 5000
    )

    $remaining = [int][Math]::Floor(($Deadline - [DateTime]::UtcNow).TotalMilliseconds)
    if ($remaining -le 0) {
        return 0
    }
    return [Math]::Min($Maximum, $remaining)
}

function Get-DockerDesktopStatus {
    param([ValidateRange(1, 60000)][int]$TimeoutMilliseconds = 5000)
    try {
        $output = Invoke-DockerDesktopStatusProbe -DockerPath $dockerPath `
            -TimeoutMilliseconds $TimeoutMilliseconds
        if ([string]::IsNullOrWhiteSpace($output)) {
            return $null
        }
        return $output | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Test-DockerDesktopRunning {
    param([ValidateRange(1, 60000)][int]$TimeoutMilliseconds = 5000)
    try {
        # Resource Saver keeps the named pipe and a cached Docker API response
        # alive after the Linux VM has stopped.  A successful `docker version`
        # alone is therefore not proof that the daemon is running.  Ask the
        # Desktop control plane for its authoritative JSON state first.
        $status = Get-DockerDesktopStatus -TimeoutMilliseconds $TimeoutMilliseconds
        if ($null -eq $status) {
            return $false
        }
        $states = @()
        foreach ($propertyName in @('Status', 'State')) {
            if ($null -ne $status.PSObject.Properties[$propertyName]) {
                $states += ([string]$status.$propertyName).Trim()
            }
        }
        return @($states | Where-Object {
            [string]::Equals($_, 'running', [System.StringComparison]::OrdinalIgnoreCase)
        }).Count -gt 0
    } catch {
        return $false
    }
}

function Test-DockerEngine {
    param([ValidateRange(1, 60000)][int]$TimeoutMilliseconds = 5000)
    if ($env:DOCKER_HOST -ne $localDockerHost -or
        -not (Test-Path -LiteralPath $enginePipe)) {
        return $false
    }

    try {
        # The status and Engine probes share one wall-clock budget. Otherwise
        # two individually bounded children could silently double the caller's
        # advertised deadline during a broken cold start.
        $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
        $remaining = Get-RemainingTimeoutMilliseconds -Deadline $deadline -Maximum $TimeoutMilliseconds
        if (($remaining -le 0) -or
            (-not (Test-DockerDesktopRunning -TimeoutMilliseconds $remaining))) {
            return $false
        }
        $remaining = Get-RemainingTimeoutMilliseconds -Deadline $deadline -Maximum $TimeoutMilliseconds
        if ($remaining -le 0) {
            return $false
        }
        $version = Invoke-BoundedProcess -FilePath $dockerPath `
            -Arguments 'version --format "server={{.Server.Version}}"' `
            -TimeoutMilliseconds $remaining
        return $version.Completed -and $version.ExitCode -eq 0 -and
            ([string]$version.StandardOutput -join ' ') -match '^server=\S+'
    } catch {
        return $false
    }
}

function Get-DockerProcesses {
    $knownNames = @(
        'Docker Desktop',
        'com.docker.backend',
        'com.docker.build',
        'com.docker.proxy',
        'vpnkit'
    )
    @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
        $process = $_
        if ($knownNames -contains $process.ProcessName) {
            return $true
        }
        try {
            return $process.Path -and
                $process.Path.StartsWith(
                    (Split-Path -Parent $desktopPath),
                    [System.StringComparison]::OrdinalIgnoreCase
                )
        } catch {
            return $false
        }
    })
}

function Test-DockerWslRunning {
    $probe = Get-DockerWslState
    if (-not $probe.Known) {
        return $null
    }
    return [bool]$probe.Running
}

function Get-DockerWslState {
    param([ValidateRange(1, 60000)][int]$TimeoutMilliseconds = 5000)
    try {
        $result = Invoke-BoundedProcess -FilePath $wslPath `
            -Arguments '--list --running --quiet' -TimeoutMilliseconds $TimeoutMilliseconds
        if (-not $result.Completed -or $result.ExitCode -ne 0) {
            return [pscustomobject]@{ Known = $false; Running = $false }
        }
        $running = @(([string]$result.StandardOutput -split "`r?`n") | ForEach-Object {
            (($_ -replace "`0", '').Trim())
        } | Where-Object { $_ })
        return [pscustomobject]@{
            Known = $true
            Running = ($running -contains 'docker-desktop')
        }
    } catch {
        return [pscustomobject]@{ Known = $false; Running = $false }
    }
}

function Test-DockerStartupFailure {
    param([ValidateRange(1, 5)][int]$TimeoutSeconds = 5)
    try {
        # Docker Desktop exposes a dedicated error-dialog process after the
        # backend has failed.  Treat that as a confirmed failed startup so a
        # non-restart auto-start invocation can enter the bounded recovery
        # path.  A normal Desktop/frontend process alone is not failure
        # evidence: WSL can legitimately take several minutes to resume.
        $errorDialog = @(Get-CimInstance Win32_Process -OperationTimeoutSec $TimeoutSeconds -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Name -eq 'Docker Desktop.exe' -and
                $_.CommandLine -match '--name=error-dialog'
            })
        return $errorDialog.Count -gt 0
    } catch {
        return $false
    }
}

function Test-DockerStartupInProgress {
    if (Test-DockerEngine) {
        return $false
    }

    # Do not interrupt a legitimate cold start.  The process/WSL signals are
    # deliberately checked instead of the named pipe alone because Resource
    # Saver and a stale pipe can outlive the Linux daemon.
    # The control plane can report `starting` before either the named pipe,
    # WSL distribution, or Desktop child process is visible. Treat that state
    # as an owned cold start so the no-`-Restart` path never rotates it.
    $status = Get-DockerDesktopStatus
    if (Test-DockerDesktopStarting -Status $status) {
        return $true
    }

    if (Test-DockerStartupFailure) {
        return $false
    }

    $processes = @(Get-DockerProcesses)
    $wsl = Get-DockerWslState
    # An unavailable WSL probe is not proof that the distribution is stopped.
    # Treat it as an owned/ambiguous startup so the automatic path cannot
    # rotate runtime parents while WSL state is unknown.
    return ($processes.Count -gt 0) -or (-not $wsl.Known) -or [bool]$wsl.Running
}

function Confirm-DockerRecoveryAuthority {
    # A no-`-Restart` repair is allowed only while an explicit Desktop error
    # dialog is present and the control plane is not beginning a new startup.
    # This second, immediately-before-stop check closes the race where an
    # error dialog disappears and Desktop starts again between the preflight
    # and the destructive stop operation. Explicit `-Restart` remains the
    # user's authority for a stopped/unknown state.
    if (Test-DockerEngine) {
        throw 'Docker engine became healthy; recovery was cancelled without stopping Desktop.'
    }

    $status = Get-DockerDesktopStatus
    if (Test-DockerDesktopStarting -Status $status) {
        throw 'Docker Desktop entered a new startup; recovery was cancelled without stopping Desktop.'
    }

    if ((-not $Restart) -and (-not (Test-DockerStartupFailure))) {
        throw 'Docker Desktop is not reporting an explicit startup failure; recovery was not authorized. Retry with -Restart after checking Desktop.'
    }
}

function Wait-DockerStartupReady {
    param([Parameter(Mandatory)][int]$Seconds)

    $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        $remaining = Get-RemainingTimeoutMilliseconds -Deadline $deadline -Maximum 5000
        if (($remaining -gt 0) -and
            (Test-DockerEngine -TimeoutMilliseconds $remaining)) {
            return $true
        }
        $remaining = Get-RemainingTimeoutMilliseconds -Deadline $deadline -Maximum 5000
        if (($remaining -ge 1000) -and
            (Test-DockerStartupFailure -TimeoutSeconds ([Math]::Max(1, [Math]::Min(5, [int][Math]::Floor($remaining / 1000)))))) {
            return $false
        }
        $remaining = Get-RemainingTimeoutMilliseconds -Deadline $deadline -Maximum 2000
        if ($remaining -gt 0) {
            Start-Sleep -Milliseconds $remaining
        }
    }

    return $false
}

function Wait-DockerStopped {
    param([Parameter(Mandatory)][int]$Seconds)

    $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        $processes = @(Get-DockerProcesses)
        $remaining = Get-RemainingTimeoutMilliseconds -Deadline $deadline -Maximum 5000
        if ($remaining -le 0) {
            return $false
        }
        $wsl = Get-DockerWslState -TimeoutMilliseconds $remaining
        $pipePresent = Test-Path -LiteralPath $enginePipe
        if (($processes.Count -eq 0) -and $wsl.Known -and (-not $wsl.Running) -and (-not $pipePresent)) {
            return $true
        }
        $remaining = Get-RemainingTimeoutMilliseconds -Deadline $deadline -Maximum 500
        if ($remaining -gt 0) {
            Start-Sleep -Milliseconds $remaining
        }
    }

    return $false
}

function Stop-DockerDesktopSafely {
    if (-not $Restart) {
        Confirm-DockerRecoveryAuthority
    }

    $wslAtEntry = Get-DockerWslState
    if ((@(Get-DockerProcesses).Count -eq 0) -and
        $wslAtEntry.Known -and (-not $wslAtEntry.Running) -and
        (-not (Test-Path -LiteralPath $enginePipe))) {
        return
    }

    # `docker desktop stop` can wait forever when the backend is already
    # broken (for example, while it is stuck removing a Windows AF_UNIX
    # socket). Only invoke the CLI while the engine is responsive, and put a
    # hard wall around the child process. If the pipe is unavailable, go
    # straight to the narrowly-scoped Docker-process/WSL termination below.
    if (Test-DockerEngine) {
        $stopCommand = Start-Process -FilePath $dockerPath `
            -ArgumentList @('desktop', 'stop', '--timeout', [string]$StopTimeoutSeconds) `
            -WindowStyle Hidden -PassThru
        $gracefulCompleted = $stopCommand.WaitForExit($StopTimeoutSeconds * 1000)
        if (-not $gracefulCompleted) {
            try {
                $stopCommand.Kill()
            } catch {
                # The bounded wait has already prevented an unbounded hang;
                # the force-stop path below remains the recovery authority.
            }
        }
        if ($gracefulCompleted -and ($stopCommand.ExitCode -eq 0) -and
            (Wait-DockerStopped -Seconds $StopTimeoutSeconds)) {
            return
        }
    }

    # The supported stop path did not fully quiesce. Force only Docker Desktop
    # processes and only Docker's own WSL distribution.
    @(Get-DockerProcesses) | Stop-Process -Force -ErrorAction SilentlyContinue
    $terminate = Invoke-BoundedProcess -FilePath $wslPath `
        -Arguments '--terminate docker-desktop' `
        -TimeoutMilliseconds ($StopTimeoutSeconds * 1000)
    if (-not $terminate.Completed) {
        # Continue to the bounded stopped-state check; never wait on a hung
        # WSL process or broaden termination to another distribution.
        Write-Warning 'WSL docker-desktop termination command timed out; the bounded stopped-state check remains authoritative.'
    }
    if (-not (Wait-DockerStopped -Seconds $StopTimeoutSeconds)) {
        $remaining = @((Get-DockerProcesses) | ForEach-Object { "$($_.ProcessName):$($_.Id)" }) -join ', '
        throw "Docker Desktop did not quiesce; runtime directories were not changed. Remaining: $remaining"
    }
}

function Invoke-DockerBackendApi {
    param(
        [ValidateSet('GET', 'POST')][string]$Method,
        [Parameter(Mandatory)][string]$Path,
        [string]$JsonBody = ''
    )

    $pipe = [System.IO.Pipes.NamedPipeClientStream]::new(
        '.',
        'dockerBackendApiServer',
        [System.IO.Pipes.PipeDirection]::InOut
    )
    try {
        $pipe.Connect(5000)
        $encoding = [System.Text.Encoding]::UTF8
        $bodyBytes = $encoding.GetBytes($JsonBody)
        $headers = "$Method $Path HTTP/1.1`r`nHost: localhost`r`nConnection: close`r`n"
        if ($Method -eq 'POST') {
            $headers += "Content-Type: application/json`r`nContent-Length: $($bodyBytes.Length)`r`n"
        }
        $requestBytes = $encoding.GetBytes("$headers`r`n$JsonBody")
        $pipe.Write($requestBytes, 0, $requestBytes.Length)
        $pipe.Flush()
        $reader = [System.IO.StreamReader]::new($pipe, $encoding, $false, 4096, $true)
        $readTask = $reader.ReadToEndAsync()
        if (-not $readTask.Wait(5000)) {
            throw 'Docker backend settings API timed out.'
        }
        $response = $readTask.Result
        $statusLine = ($response -split "`r?`n")[0]
        if ($statusLine -notmatch '^HTTP/\d(?:\.\d)?\s+(2\d\d)\b') {
            throw "Docker backend settings API returned: $statusLine"
        }
        return $response
    } finally {
        if ($null -ne $pipe) {
            $pipe.Dispose()
        }
    }
}

function Get-BackendSettings {
    $response = Invoke-DockerBackendApi -Method GET -Path '/app/settings'
    $start = $response.IndexOf('{')
    $end = $response.LastIndexOf('}')
    if (($start -lt 0) -or ($end -le $start)) {
        throw 'Docker backend settings response did not contain JSON.'
    }
    return $response.Substring($start, $end - $start + 1) | ConvertFrom-Json
}

function Get-BackendBoolean {
    param(
        [Parameter(Mandatory)]$Container,
        [Parameter(Mandatory)][string]$Name
    )

    $property = $Container.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }
    if ($property.Value -is [bool]) {
        return [bool]$property.Value
    }
    if ($null -ne $property.Value -and
        $null -ne $property.Value.PSObject.Properties['value']) {
        return [bool]$property.Value.value
    }
    return $null
}

function Wait-DockerEngineReady {
    param([Parameter(Mandatory)][int]$Seconds)

    $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        $remaining = Get-RemainingTimeoutMilliseconds -Deadline $deadline -Maximum 5000
        if (($remaining -gt 0) -and
            (Test-DockerEngine -TimeoutMilliseconds $remaining)) {
            return $true
        }
        $remaining = Get-RemainingTimeoutMilliseconds -Deadline $deadline -Maximum 2000
        if ($remaining -gt 0) {
            Start-Sleep -Milliseconds $remaining
        }
    }

    return $false
}

function Start-DockerDesktopSafely {
    # A direct Docker Desktop.exe launch and `docker desktop start --detach`
    # both keep Desktop inside the caller's Windows job object. Bounded CI and
    # agent terminals reap descendants after their command lease expires,
    # silently killing a healthy engine several minutes later. Delegate the
    # executable open to the already-running Explorer shell; Explorer becomes
    # the independent process parent while Docker's own executable remains the
    # startup authority.
    $explorerPath = Join-Path ${env:SystemRoot} 'explorer.exe'
    if (-not (Test-Path -LiteralPath $explorerPath -PathType Leaf)) {
        throw "Windows Explorer was not found at $explorerPath."
    }
    if (@(Get-Process explorer -ErrorAction SilentlyContinue).Count -eq 0) {
        throw 'An interactive Windows Explorer session is required to start Docker Desktop independently.'
    }

    # A second startup owner may have appeared between the preflight and this
    # handoff. Re-check the authoritative signals immediately before opening
    # Desktop so the per-user Run entry cannot create two Docker instances.
    if ((Test-DockerEngine -TimeoutMilliseconds 5000) -or
        (Test-DockerStartupInProgress)) {
        return
    }

    $broker = Start-Process -FilePath $explorerPath `
        -ArgumentList @("`"$desktopPath`"") `
        -WindowStyle Hidden -PassThru
    if (-not $broker.WaitForExit(15000)) {
        try {
            $broker.Kill()
        } catch {
            # The Explorer broker is only a bounded handoff process.
        }
        throw 'Windows Explorer did not acknowledge the Docker Desktop launch within 15 seconds.'
    }
    if ($broker.ExitCode -ne 0 -and
        @(Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue).Count -eq 0 -and
        -not (Test-Path -LiteralPath $enginePipe)) {
        throw "Windows Explorer could not launch Docker Desktop (exit code $($broker.ExitCode))."
    }
}

function Disable-AndVerifyDockerAi {
    if ($KeepDockerAI) {
        return
    }

    # The supported CLI toggle can restart the backend asynchronously.  Avoid
    # issuing it when the effective settings are already disabled; otherwise a
    # healthy engine can be needlessly taken offline during this safety check.
    $current = Get-BackendSettings
    $currentAi = Get-BackendBoolean -Container $current.desktop -Name 'enableDockerAI'
    $currentInference = Get-BackendBoolean -Container $current.desktop -Name 'enableInference'
    if (($currentAi -eq $false) -and ($currentInference -eq $false)) {
        return
    }

    $disable = Invoke-BoundedProcess -FilePath $dockerPath `
        -Arguments 'desktop disable model-runner' `
        -TimeoutMilliseconds ($TimeoutSeconds * 1000)
    if (-not $disable.Completed -or $disable.ExitCode -ne 0) {
        throw 'Docker engine is healthy, but the supported model-runner disable command failed.'
    }

    if (-not (Wait-DockerEngineReady -Seconds $TimeoutSeconds)) {
        throw "Docker engine did not recover within $TimeoutSeconds seconds after disabling model-runner."
    }

    [void](Invoke-DockerBackendApi -Method POST -Path '/app/settings' -JsonBody '{"enableDockerAI":false,"enableInference":false}')
    if (-not (Wait-DockerEngineReady -Seconds $TimeoutSeconds)) {
        throw "Docker engine did not remain reachable after persisting AI/Inference settings."
    }

    $settings = Get-BackendSettings
    $ai = Get-BackendBoolean -Container $settings.desktop -Name 'enableDockerAI'
    $inference = Get-BackendBoolean -Container $settings.desktop -Name 'enableInference'
    if (($ai -ne $false) -or ($inference -ne $false)) {
        throw 'Docker engine is healthy, but AI/Inference disable could not be verified.'
    }
}

function Wait-DockerStable {
    if ($StabilitySeconds -le 0) {
        return
    }

    $deadline = [DateTime]::UtcNow.AddSeconds($StabilitySeconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        $remaining = Get-RemainingTimeoutMilliseconds -Deadline $deadline -Maximum 5000
        # A full status+Engine probe needs a small amount of wall-clock room.
        # Once only the final sub-second tail remains, preserve the last
        # successful observation and let the declared stability window expire
        # instead of converting an already-healthy engine into a false failure
        # merely because a new probe could not finish before the deadline.
        if ($remaining -lt 1000) {
            if ($remaining -gt 0) {
                Start-Sleep -Milliseconds $remaining
            }
            break
        }
        if (-not (Test-DockerEngine -TimeoutMilliseconds $remaining)) {
            throw "Docker engine became unavailable during the $StabilitySeconds-second stability gate."
        }
        $remaining = Get-RemainingTimeoutMilliseconds -Deadline $deadline -Maximum 2000
        if ($remaining -gt 0) {
            Start-Sleep -Milliseconds $remaining
        }
    }
}

Assert-DockerHostCapacity -Path $dockerRoot -MinimumFreeBytes $MinimumHostFreeBytes
$recoveryLock = Open-DockerRecoveryLock -Path $recoveryLockPath
try {
    if (-not $Restart) {
        if (Test-DockerEngine) {
            Disable-AndVerifyDockerAi
            if (-not $KeepDockerAI) {
                [void](Set-DockerAiStore -SettingsPath $settingsPath)
            }
            Wait-DockerStable
            Write-Output 'Docker Desktop engine is healthy; AI/Inference settings were verified and no runtime rotation was needed.'
            return
        }

        if (Test-DockerStartupInProgress) {
            Write-Output "Docker Desktop is already starting; waiting up to $TimeoutSeconds seconds before taking any recovery action."
            if (Wait-DockerStartupReady -Seconds $TimeoutSeconds) {
                Disable-AndVerifyDockerAi
                if (-not $KeepDockerAI) {
                    [void](Set-DockerAiStore -SettingsPath $settingsPath)
                }
                Wait-DockerStable
                Write-Output 'Docker Desktop engine became healthy during an existing startup; no stop or runtime rotation was performed.'
                return
            }

            Confirm-DockerRecoveryAuthority
            Write-Warning 'Docker Desktop reported a startup error; continuing with the bounded stale-runtime recovery path.'
        } else {
            # A cleanly stopped machine is the normal state at logon for the
            # per-user Run entry. Start it without stopping or rotating any
            # runtime parent. If the new startup reports an explicit error,
            # the recovery path below becomes authorized; an unexplained
            # timeout fails closed and leaves the host untouched.
            Write-Output "Docker Desktop is stopped; starting it without runtime rotation and waiting up to $TimeoutSeconds seconds."
            Start-DockerDesktopSafely
            if (Wait-DockerStartupReady -Seconds $TimeoutSeconds) {
                Disable-AndVerifyDockerAi
                if (-not $KeepDockerAI) {
                    [void](Set-DockerAiStore -SettingsPath $settingsPath)
                }
                Wait-DockerStable
                Write-Output 'Docker Desktop became healthy after a clean start; no stop or runtime rotation was performed.'
                return
            }

            Confirm-DockerRecoveryAuthority
            Write-Warning 'Docker Desktop reported a startup error after a clean start; continuing with the bounded stale-runtime recovery path.'
        }
    }

    Stop-DockerDesktopSafely
    $quarantined = @()
    try {
        $rotated = Rotate-DockerRuntimeDirectories -Paths $runtimeDirectories -AllowedPaths $runtimeDirectories
        foreach ($entry in $rotated) {
            foreach ($quarantine in @($entry.Quarantines)) {
                if ($quarantine) {
                    $quarantined += $quarantine
                }
            }
        }
    } catch {
        throw "Docker was stopped, but exact runtime rotation failed safely: $($_.Exception.Message)"
    }

    # The settings store is changed only after Desktop is stopped and the
    # exact runtime parents are quarantined. This prevents a settings write
    # from triggering a concurrent backend reload during cold-start recovery.
    if (-not $KeepDockerAI) {
        [void](Set-DockerAiStore -SettingsPath $settingsPath)
    }

    Start-DockerDesktopSafely

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $healthyAfterRecovery = $false
    while ([DateTime]::UtcNow -lt $deadline) {
        $remaining = Get-RemainingTimeoutMilliseconds -Deadline $deadline -Maximum 3000
        if ($remaining -gt 0) {
            Start-Sleep -Milliseconds $remaining
        }
        $remaining = Get-RemainingTimeoutMilliseconds -Deadline $deadline -Maximum 5000
        if (($remaining -gt 0) -and
            (Test-DockerEngine -TimeoutMilliseconds $remaining)) {
            $healthyAfterRecovery = $true
            break
        }
    }

    # Do not add an unbudgeted final Engine probe here. The last bounded probe
    # above is the authoritative result for this recovery deadline; a fresh
    # probe after expiry could make a caller that asked for N seconds wait
    # another several seconds merely to print the failure diagnostics.
    if (-not $healthyAfterRecovery) {
        $errorPath = Join-Path $dockerRoot 'backend.error.json'
        $detail = if (Test-Path -LiteralPath $errorPath -PathType Leaf) {
            [System.IO.File]::ReadAllText($errorPath)
        } else {
            'No backend.error.json was produced.'
        }
        throw "Docker Desktop did not become healthy within $TimeoutSeconds seconds. Quarantine was preserved for rollback/diagnostics. $detail"
    }

    Disable-AndVerifyDockerAi
    Wait-DockerStable

    $versionResult = Invoke-BoundedProcess -FilePath $dockerPath `
        -Arguments 'version --format "{{.Server.Version}}"' `
        -TimeoutMilliseconds 5000
    $serverVersion = if ($versionResult.Completed -and $versionResult.ExitCode -eq 0) {
        ([string]$versionResult.StandardOutput -split "`r?`n" | Select-Object -Last 1).Trim()
    } else {
        'unknown'
    }
    Write-Output "Docker Desktop is healthy (local engine $serverVersion)."
    foreach ($directory in $quarantined) {
        Write-Output "Runtime directory quarantined: $directory"
    }
    $summary = Get-DockerRuntimeQuarantineSummary -RuntimePaths $runtimeDirectories
    Write-Output "Runtime quarantine summary: $($summary.Count) directories, $($summary.AccessibleBytes) accessible bytes. No automatic deletion was performed."
    Write-Output 'No Docker image, volume, WSL data disk, other WSL distribution, or Hibernate setting was changed.'
} finally {
    if ($null -ne $recoveryLock) {
        $recoveryLock.Dispose()
    }
}
