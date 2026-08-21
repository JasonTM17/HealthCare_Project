function Resolve-ExecutablePath {
    param(
        [Parameter(Mandatory)] [string]$CommandName,
        [string]$ConfiguredPath
    )

    if (-not [string]::IsNullOrWhiteSpace($ConfiguredPath)) {
        return $ConfiguredPath
    }

    $command = Get-Command $CommandName -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "$CommandName CLI was not found"
    }

    foreach ($candidate in @($command.Source, $command.Path, $command.Definition)) {
        if (-not [string]::IsNullOrWhiteSpace($candidate)) {
            return $candidate
        }
    }

    throw "Unable to resolve an executable path for $CommandName"
}

function Assert-ExpectedRevision {
    param(
        [Parameter(Mandatory)] [string]$Revision
    )

    if ($Revision -notmatch '^[0-9a-fA-F]{40}$') {
        throw "Expected a 40-character Git revision, but received '$Revision'"
    }
}

function Get-SourceRevision {
    param(
        [Parameter(Mandatory)] [string]$RepositoryRoot,
        [string]$GitExecutable
    )

    $git = Resolve-ExecutablePath -CommandName git -ConfiguredPath $GitExecutable
    $revisionOutput = & $git -C $RepositoryRoot rev-parse HEAD 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read the current Git revision from $RepositoryRoot"
    }

    $revision = $revisionOutput | Select-Object -First 1
    if ($null -eq $revision) {
        throw "Git returned no source revision for $RepositoryRoot"
    }

    $revision = $revision.ToString().Trim()
    if ($revision -notmatch '^[0-9a-fA-F]{40}$') {
        throw "Git returned an invalid source revision for $RepositoryRoot"
    }

    return $revision.ToLowerInvariant()
}

function Assert-SourceRevisionMatches {
    param(
        [Parameter(Mandatory)] [string]$RepositoryRoot,
        [Parameter(Mandatory)] [string]$ExpectedRevision,
        [string]$GitExecutable
    )

    Assert-ExpectedRevision -Revision $ExpectedRevision
    $observedRevision = Get-SourceRevision -RepositoryRoot $RepositoryRoot -GitExecutable $GitExecutable
    if ($observedRevision -ne $ExpectedRevision.ToLowerInvariant()) {
        throw "Git source revision changed while the local MVP build was running"
    }
}

function New-ImmutableBuildSnapshot {
    param(
        [Parameter(Mandatory)] [string]$RepositoryRoot,
        [Parameter(Mandatory)] [string]$Revision,
        [string]$GitExecutable
    )

    Assert-ExpectedRevision -Revision $Revision

    $git = Resolve-ExecutablePath -CommandName git -ConfiguredPath $GitExecutable
    $snapshotParent = Join-Path (Join-Path $RepositoryRoot ".agentkit") "tmp"
    $snapshotName = "healthcare-build-snapshot-$($Revision.Substring(0, 12))-$([guid]::NewGuid().ToString('N'))"
    $snapshotRoot = Join-Path $snapshotParent $snapshotName
    $archivePath = "$snapshotRoot.zip"

    try {
        New-Item -ItemType Directory -Path $snapshotParent -Force | Out-Null
        & $git -C $RepositoryRoot archive --format=zip "--output=$archivePath" $Revision
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to archive Git revision $Revision for an immutable Docker build context"
        }

        New-Item -ItemType Directory -Path $snapshotRoot | Out-Null
        Expand-Archive -LiteralPath $archivePath -DestinationPath $snapshotRoot -Force
        $snapshotComposeFile = Join-Path (Join-Path $snapshotRoot "infrastructure") "docker-compose.yml"
        if (-not (Test-Path -LiteralPath $snapshotComposeFile -PathType Leaf)) {
            throw "Git archive for $Revision does not contain infrastructure/docker-compose.yml"
        }

        return $snapshotRoot
    } catch {
        if (Test-Path -LiteralPath $snapshotRoot) {
            Remove-Item -LiteralPath $snapshotRoot -Recurse -Force
        }
        throw
    } finally {
        if (Test-Path -LiteralPath $archivePath) {
            Remove-Item -LiteralPath $archivePath -Force
        }
    }
}

function Remove-ImmutableBuildSnapshot {
    param(
        [Parameter(Mandatory)] [string]$RepositoryRoot,
        [Parameter(Mandatory)] [string]$SnapshotRoot
    )

    $snapshotParent = [IO.Path]::GetFullPath((Join-Path (Join-Path $RepositoryRoot ".agentkit") "tmp"))
    $snapshotFullPath = [IO.Path]::GetFullPath($SnapshotRoot)
    $parentPrefix = $snapshotParent.TrimEnd([char[]]@('\', '/')) + [IO.Path]::DirectorySeparatorChar
    $snapshotName = [IO.Path]::GetFileName($snapshotFullPath)

    if (-not $snapshotFullPath.StartsWith($parentPrefix, [StringComparison]::OrdinalIgnoreCase) -or $snapshotName -notlike "healthcare-build-snapshot-*") {
        throw "Refusing to remove a build snapshot outside the generated snapshot directory"
    }

    if (Test-Path -LiteralPath $snapshotFullPath) {
        Remove-Item -LiteralPath $snapshotFullPath -Recurse -Force
    }
}

function Assert-CleanBuildContext {
    param(
        [Parameter(Mandatory)] [string]$RepositoryRoot,
        [string]$GitExecutable
    )

    $git = Resolve-ExecutablePath -CommandName git -ConfiguredPath $GitExecutable
    $statusOutput = & $git -C $RepositoryRoot status --porcelain --untracked-files=all 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to inspect the build context in $RepositoryRoot"
    }

    $dirtyEntries = @($statusOutput | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($dirtyEntries.Count -gt 0) {
        $sample = ($dirtyEntries | Select-Object -First 10) -join [Environment]::NewLine
        throw "Build context must be clean before building the image:`n$sample"
    }
}

function Assert-ContainerRevision {
    param(
        [Parameter(Mandatory)] [string]$ContainerName,
        [Parameter(Mandatory)] [string]$Revision,
        [string]$DockerExecutable
    )

    Assert-ExpectedRevision -Revision $Revision

    $docker = Resolve-ExecutablePath -CommandName docker -ConfiguredPath $DockerExecutable
    $observedRevision = & $docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' $ContainerName 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read the OCI revision label from container $ContainerName"
    }

    $observedRevision = $observedRevision | Select-Object -First 1
    if ($null -eq $observedRevision) {
        $observedRevision = ""
    } else {
        $observedRevision = $observedRevision.ToString().Trim()
    }

    if ($observedRevision -ne $Revision) {
        throw "Container $ContainerName is not labeled with the expected source revision"
    }
}
