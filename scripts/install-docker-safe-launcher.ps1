[CmdletBinding()]
param(
    [switch]$InstallAutoStart,
    [switch]$Restore,
    [string]$ShortcutPath = (Join-Path ${env:APPDATA} 'Microsoft\Windows\Start Menu\Programs\Docker Desktop.lnk'),
    [string]$RunKeyPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run',
    [string]$RunValueName = 'Docker Desktop',
    [string]$RunStatePath = (Join-Path ${env:APPDATA} 'Docker\safe-launcher-state.json'),
    [string]$DesktopPath = (Join-Path ${env:ProgramFiles} 'Docker\Docker\Docker Desktop.exe'),
    [string]$PowerShellPath = (Join-Path ${env:SystemRoot} 'System32\WindowsPowerShell\v1.0\powershell.exe')
)

$ErrorActionPreference = 'Stop'

if ($InstallAutoStart -and $Restore) {
    throw 'Choose either -InstallAutoStart or -Restore.'
}
if (-not [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform(
        [System.Runtime.InteropServices.OSPlatform]::Windows)) {
    throw 'This installer is only for Windows Docker Desktop.'
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$safeScript = Join-Path $PSScriptRoot 'start-docker-safe.ps1'
if (-not (Test-Path -LiteralPath $safeScript -PathType Leaf)) {
    throw "Missing recovery launcher: $safeScript"
}
if (-not (Test-Path -LiteralPath $DesktopPath -PathType Leaf)) {
    throw "Docker Desktop was not found at $DesktopPath."
}
if (-not (Test-Path -LiteralPath $PowerShellPath -PathType Leaf)) {
    throw "Windows PowerShell was not found at $PowerShellPath."
}

$arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$safeScript`""
$runCommand = "`"$PowerShellPath`" $arguments"
$shell = New-Object -ComObject WScript.Shell
$shortcutBackup = "$ShortcutPath.before-safe-start.lnk"

if ($Restore) {
    if (Test-Path -LiteralPath $shortcutBackup -PathType Leaf) {
        Copy-Item -LiteralPath $shortcutBackup -Destination $ShortcutPath -Force
        Write-Output "Restored shortcut: $ShortcutPath"
    } else {
        Write-Warning "Shortcut backup was not found: $shortcutBackup"
    }

    if (Test-Path -LiteralPath $RunStatePath -PathType Leaf) {
        $state = [System.IO.File]::ReadAllText($RunStatePath) | ConvertFrom-Json
        $hasOriginalExists = $null -ne $state.PSObject.Properties['originalExists']
        $originalExists = if ($hasOriginalExists) {
            [bool]$state.originalExists
        } else {
            -not [string]::IsNullOrWhiteSpace([string]$state.originalValue)
        }
        if ($originalExists) {
            New-ItemProperty -LiteralPath $RunKeyPath -Name $RunValueName -Value ([string]$state.originalValue) -PropertyType String -Force | Out-Null
        } else {
            Remove-ItemProperty -LiteralPath $RunKeyPath -Name $RunValueName -ErrorAction SilentlyContinue
        }
        Write-Output "Restored per-user launch entry: $RunValueName"
    } else {
        Write-Warning "Run-entry backup was not found; the Run entry was not changed: $RunStatePath"
    }
    Write-Output 'Restore completed; backup files were retained.'
    exit 0
}

if (Test-Path -LiteralPath $ShortcutPath -PathType Leaf) {
    if (-not (Test-Path -LiteralPath $shortcutBackup -PathType Leaf)) {
        Copy-Item -LiteralPath $ShortcutPath -Destination $shortcutBackup
    }

    $shortcut = $shell.CreateShortcut($ShortcutPath)
    $shortcut.TargetPath = $PowerShellPath
    $shortcut.Arguments = $arguments
    $shortcut.WorkingDirectory = $repositoryRoot
    $shortcut.IconLocation = "$DesktopPath,0"
    $shortcut.Description = 'Docker Desktop (safe AF_UNIX recovery launcher)'
    $shortcut.Save()
    Write-Output "Updated shortcut: $ShortcutPath"
} else {
    Write-Warning "Docker Desktop Start Menu shortcut was not found: $ShortcutPath"
}

if ($InstallAutoStart) {
    if (-not (Test-Path -LiteralPath $RunKeyPath)) {
        New-Item -Path $RunKeyPath -Force | Out-Null
    }
    $existingRun = (Get-ItemProperty -LiteralPath $RunKeyPath -Name $RunValueName -ErrorAction SilentlyContinue).$RunValueName
    if (-not (Test-Path -LiteralPath $RunStatePath -PathType Leaf)) {
        $stateDirectory = Split-Path -Parent $RunStatePath
        New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
        $state = [ordered]@{
            valueName = $RunValueName
            originalExists = -not [string]::IsNullOrWhiteSpace([string]$existingRun)
            originalValue = [string]$existingRun
            savedAt = (Get-Date).ToUniversalTime().ToString('o')
        }
        [System.IO.File]::WriteAllText(
            $RunStatePath,
            ($state | ConvertTo-Json -Compress),
            [System.Text.UTF8Encoding]::new($false)
        )
    }
    New-ItemProperty -LiteralPath $RunKeyPath -Name $RunValueName -Value $runCommand -PropertyType String -Force | Out-Null
    Write-Output "Installed opt-in per-user Docker launch entry: $RunValueName"
} else {
    Write-Output 'Per-user auto-start was left unchanged. Use -InstallAutoStart only when explicitly desired.'
}

Write-Output 'Original shortcut/Run value backups are retained for -Restore.'
