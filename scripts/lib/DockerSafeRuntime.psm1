Set-StrictMode -Version 2.0

function Assert-ExactAllowedPath {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string[]]$AllowedPaths
    )

    $resolvedCandidate = [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
    $allowed = @($AllowedPaths | ForEach-Object {
        [System.IO.Path]::GetFullPath($_).TrimEnd('\')
    })
    if (-not ($allowed | Where-Object {
            [string]::Equals($_, $resolvedCandidate, [System.StringComparison]::OrdinalIgnoreCase)
        })) {
        throw "Refusing to rotate a path outside the exact Docker runtime allowlist: $Path"
    }

    # Resolve only the existing ancestor chain.  A junction/symlink anywhere
    # above the exact runtime path could redirect Move-Item into user data;
    # reject it instead of following it.  Missing leaves are allowed because
    # the caller may be creating a fresh runtime directory.
    $cursor = $resolvedCandidate
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            $item = Get-Item -LiteralPath $cursor -Force
            if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Refusing to traverse a reparse-point ancestor of the Docker runtime path: $cursor"
            }
        }

        $parent = Split-Path -Parent $cursor
        if ((-not $parent) -or [string]::Equals($parent, $cursor, [System.StringComparison]::OrdinalIgnoreCase)) {
            break
        }
        $cursor = $parent
    }

    return $resolvedCandidate
}

function Set-DockerAiStore {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$SettingsPath)

    if (-not (Test-Path -LiteralPath $SettingsPath -PathType Leaf)) {
        throw "Docker settings store was not found: $SettingsPath"
    }

    $raw = [System.IO.File]::ReadAllText($SettingsPath)
    try {
        $settings = $raw | ConvertFrom-Json
    } catch {
        throw "Docker settings store is not valid JSON: $SettingsPath"
    }

    foreach ($name in @('EnableDockerAI', 'EnableInference')) {
        $property = $settings.PSObject.Properties[$name]
        if ($null -eq $property) {
            $settings | Add-Member -MemberType NoteProperty -Name $name -Value $false
        } else {
            $property.Value = $false
        }
    }

    $backup = "$SettingsPath.before-safe-start"
    if (-not (Test-Path -LiteralPath $backup -PathType Leaf)) {
        Copy-Item -LiteralPath $SettingsPath -Destination $backup
    }

    $updated = $settings | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText(
        $SettingsPath,
        $updated,
        [System.Text.UTF8Encoding]::new($false)
    )

    $verified = [System.IO.File]::ReadAllText($SettingsPath) | ConvertFrom-Json
    if (($verified.EnableDockerAI -ne $false) -or ($verified.EnableInference -ne $false)) {
        throw 'Docker AI/Inference settings were not persisted as false before startup.'
    }

    return $backup
}

function Assert-DockerHostCapacity {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [ValidateRange(0, [long]::MaxValue)][long]$MinimumFreeBytes
    )

    if ($MinimumFreeBytes -le 0) {
        return
    }

    $resolvedPath = [System.IO.Path]::GetFullPath($Path)
    $root = [System.IO.Path]::GetPathRoot($resolvedPath)
    if ([string]::IsNullOrWhiteSpace($root)) {
        throw "Docker host path has no filesystem root: $resolvedPath"
    }

    $driveName = $root.Substring(0, 1)
    $drive = Get-PSDrive -Name $driveName -PSProvider FileSystem -ErrorAction Stop
    if ($drive.Free -lt $MinimumFreeBytes) {
        $freeGiB = [math]::Round($drive.Free / 1GB, 2)
        $requiredGiB = [math]::Round($MinimumFreeBytes / 1GB, 2)
        throw "Docker host drive $driveName`: has only $freeGiB GiB free; at least $requiredGiB GiB is required before startup. Free space or move Docker data, then retry."
    }
}

function Open-DockerRecoveryLock {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $resolvedPath = [System.IO.Path]::GetFullPath($Path)
    $parent = Split-Path -Parent $resolvedPath
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
        New-Item -ItemType Directory -Path $parent -ErrorAction Stop | Out-Null
    }

    try {
        # An OS-held handle is released automatically if a launcher crashes;
        # unlike a PID/marker file, it cannot become a stale false lock.
        return [System.IO.File]::Open(
            $resolvedPath,
            [System.IO.FileMode]::OpenOrCreate,
            [System.IO.FileAccess]::ReadWrite,
            [System.IO.FileShare]::None
        )
    } catch [System.IO.IOException] {
        throw "Another Docker safe launcher is already running (lock: $resolvedPath)."
    }
}

function Rotate-DockerRuntimeDirectory {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string[]]$AllowedPaths,
        [ValidateRange(0, 5000)][int]$SettleMilliseconds = 750,
        [ValidateRange(0, 10)][int]$MaximumRecreations = 3
    )

    $exactPath = Assert-ExactAllowedPath -Path $Path -AllowedPaths $AllowedPaths
    $parent = Split-Path -Parent $exactPath
    $leaf = Split-Path -Leaf $exactPath
    $quarantines = @()
    $hadOriginal = Test-Path -LiteralPath $exactPath
    $originalQuarantine = $null

    # Docker auxiliary processes can recreate engine.sock after the Desktop
    # process and docker-desktop WSL distribution have both exited. Rotate any
    # such late recreation into its own recoverable quarantine and require the
    # replacement parent to remain empty for a bounded settle window. Never
    # delete or merge either copy.
    for ($attempt = 0; $attempt -le $MaximumRecreations; $attempt++) {
        if (Test-Path -LiteralPath $exactPath) {
            $item = Get-Item -LiteralPath $exactPath -Force
            if (-not $item.PSIsContainer) {
                throw "Expected a Docker runtime directory, found a file: $exactPath"
            }

            if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Docker runtime parent is a reparse point; refusing automatic unlink or traversal: $exactPath"
            }

            $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
            $quarantine = Join-Path $parent "$leaf.stale-$stamp"
            $suffix = 0
            while (Test-Path -LiteralPath $quarantine) {
                $suffix++
                $quarantine = Join-Path $parent "$leaf.stale-$stamp-$suffix"
            }

            Move-Item -LiteralPath $exactPath -Destination $quarantine
            $quarantines += $quarantine
            if ($null -eq $originalQuarantine -and $hadOriginal) {
                $originalQuarantine = $quarantine
            }
        }

        try {
            New-Item -ItemType Directory -Path $exactPath -ErrorAction Stop | Out-Null
        } catch {
            # A late Docker auxiliary process can win the narrow gap between
            # the move and New-Item. Accept only a normal exact-path directory;
            # the settle/empty check below will quarantine its contents.
            if (-not (Test-Path -LiteralPath $exactPath -PathType Container)) {
                if ($originalQuarantine -and
                    (Test-Path -LiteralPath $originalQuarantine) -and
                    (-not (Test-Path -LiteralPath $exactPath))) {
                    Move-Item -LiteralPath $originalQuarantine -Destination $exactPath
                }
                throw
            }
            $recreated = Get-Item -LiteralPath $exactPath -Force
            if (($recreated.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Docker runtime parent was recreated as a reparse point; refusing automatic traversal: $exactPath"
            }
        }

        if ($SettleMilliseconds -gt 0) {
            Start-Sleep -Milliseconds $SettleMilliseconds
        }
        $lateEntries = @(Get-ChildItem -LiteralPath $exactPath -Force -ErrorAction Stop | Select-Object -First 1)
        if ($lateEntries.Count -eq 0) {
            return [pscustomobject]@{
                Path = $exactPath
                Quarantine = $originalQuarantine
                Quarantines = @($quarantines)
                HadOriginal = $hadOriginal
            }
        }
    }

    throw "Docker runtime directory was recreated more than $MaximumRecreations times during bounded rotation: $exactPath. Quarantines were preserved."
}

function Rotate-DockerRuntimeDirectories {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string[]]$Paths,
        [Parameter(Mandatory)][string[]]$AllowedPaths
    )

    $rotated = @()
    try {
        foreach ($path in $Paths) {
            $rotated += Rotate-DockerRuntimeDirectory -Path $path -AllowedPaths $AllowedPaths
        }
    } catch {
        # Roll back only newly created empty parents and moved parents.  If a
        # process recreated content, leave it in place and report the failure;
        # never recurse or remove user data during rollback.
        # `Select-Object -Reverse` is not a PowerShell parameter (Windows
        # PowerShell 5.1 and pwsh both reject it). Walk the array by index so
        # rollback is compatible with every supported Windows shell and the
        # last successfully rotated path is restored first.
        for ($index = $rotated.Count - 1; $index -ge 0; $index--) {
            $entry = $rotated[$index]
            try {
                if (Test-Path -LiteralPath $entry.Path -PathType Container) {
                    [System.IO.Directory]::Delete($entry.Path, $false)
                }
                if ($entry.HadOriginal -and $entry.Quarantine -and
                    (Test-Path -LiteralPath $entry.Quarantine) -and
                    (-not (Test-Path -LiteralPath $entry.Path))) {
                    Move-Item -LiteralPath $entry.Quarantine -Destination $entry.Path
                }
            } catch {
                throw "Runtime rotation failed and rollback was incomplete for $($entry.Path): $($_.Exception.Message)"
            }
        }
        throw
    }

    return $rotated
}

function Get-DockerRuntimeQuarantineSummary {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string[]]$RuntimePaths)

    $directories = foreach ($path in $RuntimePaths) {
        $parent = Split-Path -Parent $path
        $leaf = Split-Path -Leaf $path
        if (Test-Path -LiteralPath $parent -PathType Container) {
            Get-ChildItem -LiteralPath $parent -Directory -Force -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -like "$leaf.stale-*" }
        }
    }

    $files = foreach ($directory in @($directories)) {
        Get-ChildItem -LiteralPath $directory.FullName -File -Force -Recurse -ErrorAction SilentlyContinue
    }
    $bytes = (@($files) | Measure-Object -Property Length -Sum).Sum
    if ($null -eq $bytes) {
        $bytes = 0
    }

    [pscustomobject]@{
        Count = @($directories).Count
        AccessibleBytes = [long]$bytes
    }
}

Export-ModuleMember -Function Set-DockerAiStore, Assert-DockerHostCapacity, Open-DockerRecoveryLock, Rotate-DockerRuntimeDirectory, Rotate-DockerRuntimeDirectories, Get-DockerRuntimeQuarantineSummary
