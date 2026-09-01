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

function Get-DockerDesktopStatus {
    try {
        $output = Invoke-DockerDesktopStatusProbe -DockerPath $dockerPath
        if ([string]::IsNullOrWhiteSpace($output)) {
            return $null
        }
        return $output | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Test-DockerDesktopRunning {
    try {
        # Resource Saver keeps the named pipe and a cached Docker API response
        # alive after the Linux VM has stopped.  A successful `docker version`
        # alone is therefore not proof that the daemon is running.  Ask the
        # Desktop control plane for its authoritative JSON state first.
        $status = Get-DockerDesktopStatus
        if ($null -eq $status) {
            return $false
        }
        return [string]::Equals(
            [string]$status.Status,
            'running',
            [System.StringComparison]::OrdinalIgnoreCase
        )
    } catch {
        return $false
    }
}

function Test-DockerEngine {
    if ($env:DOCKER_HOST -ne $localDockerHost -or
        -not (Test-Path -LiteralPath $enginePipe)) {
        return $false
    }

    try {
        if (-not (Test-DockerDesktopRunning)) {
            return $false
        }
        $version = & $dockerPath version --format 'server={{.Server.Version}}' 2>$null
        return $LASTEXITCODE -eq 0 -and ($version -join ' ') -match '^server=\S+'
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
    try {
        $running = @(& wsl.exe --list --running --quiet 2>$null | ForEach-Object {
            (([string]$_) -replace "`0", '').Trim()
        } | Where-Object { $_ })
        return $running -contains 'docker-desktop'
    } catch {
        return $false
    }
}

function Wait-DockerStopped {
    param([Parameter(Mandatory)][int]$Seconds)

    $deadline = (Get-Date).AddSeconds($Seconds)
    do {
        $processes = @(Get-DockerProcesses)
        $wslRunning = Test-DockerWslRunning
        $pipePresent = Test-Path -LiteralPath $enginePipe
        if (($processes.Count -eq 0) -and (-not $wslRunning) -and (-not $pipePresent)) {
            return $true
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    return $false
}

function Stop-DockerDesktopSafely {
    if ((@(Get-DockerProcesses).Count -eq 0) -and
        (-not (Test-DockerWslRunning)) -and
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
    $null = & wsl.exe --terminate docker-desktop 2>$null
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

    $deadline = (Get-Date).AddSeconds($Seconds)
    do {
        if (Test-DockerEngine) {
            return $true
        }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)

    return $false
}

function Start-DockerDesktopSafely {
    # Start Docker Desktop through its supported CLI control plane.  Launching
    # Docker Desktop.exe directly makes the GUI/backend inherit the terminal's
    # Windows job object; when a bounded runner tears that job down, the
    # otherwise healthy engine is killed with it.  The CLI asks Desktop's own
    # service to start and then returns, so the app lifetime is independent of
    # this recovery process.
    $startCommand = Start-Process -FilePath $dockerPath `
        -ArgumentList @('desktop', 'start', '--detach') `
        -WindowStyle Hidden -PassThru
    $completed = $startCommand.WaitForExit($TimeoutSeconds * 1000)
    if (-not $completed) {
        try {
            $startCommand.Kill()
        } catch {
            # The bounded wait has already prevented an unbounded hang.
        }
        throw "Docker Desktop start command did not finish within $TimeoutSeconds seconds."
    }
    if ($startCommand.ExitCode -ne 0) {
        throw "Docker Desktop start command failed with exit code $($startCommand.ExitCode)."
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

    & $dockerPath desktop disable model-runner 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
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

    $deadline = (Get-Date).AddSeconds($StabilitySeconds)
    while ((Get-Date) -lt $deadline) {
        if (-not (Test-DockerEngine)) {
            throw "Docker engine became unavailable during the $StabilitySeconds-second stability gate."
        }
        Start-Sleep -Seconds 2
    }
}

Assert-DockerHostCapacity -Path $dockerRoot -MinimumFreeBytes $MinimumHostFreeBytes
$recoveryLock = Open-DockerRecoveryLock -Path $recoveryLockPath
try {
    if (-not $KeepDockerAI) {
        [void](Set-DockerAiStore -SettingsPath $settingsPath)
    }

    if ((-not $Restart) -and (Test-DockerEngine)) {
        Disable-AndVerifyDockerAi
        Wait-DockerStable
        Write-Output 'Docker Desktop engine is healthy; AI/Inference settings were verified and no runtime rotation was needed.'
        return
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

    Start-DockerDesktopSafely

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 3
        if (Test-DockerEngine) {
            break
        }
    }

    if (-not (Test-DockerEngine)) {
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

    $serverVersion = (& $dockerPath version --format '{{.Server.Version}}' 2>$null | Select-Object -Last 1).Trim()
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
