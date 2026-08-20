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
