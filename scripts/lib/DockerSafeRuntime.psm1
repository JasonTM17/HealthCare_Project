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

function Rotate-DockerRuntimeDirectory {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string[]]$AllowedPaths
    )

    $exactPath = Assert-ExactAllowedPath -Path $Path -AllowedPaths $AllowedPaths
    $parent = Split-Path -Parent $exactPath
    $leaf = Split-Path -Leaf $exactPath
    $quarantine = $null
    $moved = $false

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
        $moved = $true
    }

    try {
        New-Item -ItemType Directory -Path $exactPath -ErrorAction Stop | Out-Null
    } catch {
        if ($moved -and (-not (Test-Path -LiteralPath $exactPath)) -and
            (Test-Path -LiteralPath $quarantine)) {
            Move-Item -LiteralPath $quarantine -Destination $exactPath
        }
        throw
    }

    [pscustomobject]@{
        Path = $exactPath
        Quarantine = $quarantine
        HadOriginal = $moved
    }
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
        foreach ($entry in @($rotated | Select-Object -Reverse)) {
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

Export-ModuleMember -Function Set-DockerAiStore, Rotate-DockerRuntimeDirectory, Rotate-DockerRuntimeDirectories, Get-DockerRuntimeQuarantineSummary
