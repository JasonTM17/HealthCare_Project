[CmdletBinding()]
param(
    [string]$ComposeFile = (Join-Path (Split-Path $PSScriptRoot -Parent) "infrastructure/docker-compose.yml"),
    [string]$OutputDirectory = (Join-Path (Split-Path $PSScriptRoot -Parent) "backups"),
    [string]$ProjectName = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-DockerText {
    param([Parameter(Mandatory)][string[]]$Arguments)

    $output = & docker @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed (exit $LASTEXITCODE): $($output -join [Environment]::NewLine)"
    }
    return ($output -join [Environment]::NewLine).Trim()
}

function Export-PostgresDump {
    param(
        [Parameter(Mandatory)][string[]]$ComposeArguments,
        [Parameter(Mandatory)][string]$Destination
    )

    $partialPath = "$Destination.partial"
    $processInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $processInfo.FileName = "docker"
    $processInfo.UseShellExecute = $false
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    foreach ($argument in ($ComposeArguments + @(
        "exec", "-T", "postgres", "sh", "-ec",
        'exec pg_dump --format=custom --no-owner --no-privileges --dbname="$POSTGRES_DB" --username="$POSTGRES_USER"'
    ))) {
        [void]$processInfo.ArgumentList.Add($argument)
    }

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $processInfo
    if (-not $process.Start()) { throw "Could not start pg_dump through Docker Compose." }
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $stream = [System.IO.File]::Open($partialPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write)
    try {
        $process.StandardOutput.BaseStream.CopyTo($stream)
    } finally {
        $stream.Dispose()
    }
    $process.WaitForExit()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    if ($process.ExitCode -ne 0) {
        throw "pg_dump failed (exit $($process.ExitCode)). Partial output was retained for diagnosis. $stderr"
    }
    if ((Get-Item -LiteralPath $partialPath).Length -eq 0) {
        throw "pg_dump returned an empty archive. Partial output was retained for diagnosis."
    }
    [System.IO.File]::Move($partialPath, $Destination, $false)
}

$composePath = [System.IO.Path]::GetFullPath($ComposeFile)
if (-not (Test-Path -LiteralPath $composePath -PathType Leaf)) {
    throw "Compose file does not exist: $composePath"
}

$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
[void](New-Item -ItemType Directory -Path $outputRoot -Force)
$snapshotName = "healthcare-{0}-{1}" -f (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ"), ([guid]::NewGuid().ToString("N").Substring(0, 8))
$snapshotDirectory = [System.IO.Path]::GetFullPath((Join-Path $outputRoot $snapshotName))
if (-not $snapshotDirectory.StartsWith($outputRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar,
        [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to create a backup outside the requested output directory."
}
[void](New-Item -ItemType Directory -Path $snapshotDirectory)

$composeArguments = @("compose", "-f", $composePath)
if (-not [string]::IsNullOrWhiteSpace($ProjectName)) {
    $composeArguments += @("--project-name", $ProjectName.Trim())
}

[void](Invoke-DockerText -Arguments @("version", "--format", "{{.Server.Version}}"))
$runningServices = Invoke-DockerText -Arguments ($composeArguments + @("ps", "--status", "running", "--services"))
$serviceNames = @($runningServices -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
foreach ($requiredService in @("postgres", "minio")) {
    if ($requiredService -notin $serviceNames) {
        throw "Compose service '$requiredService' must be running before backup. No existing data was changed."
    }
}

$postgresArchive = Join-Path $snapshotDirectory "postgres.dump"
Export-PostgresDump -ComposeArguments $composeArguments -Destination $postgresArchive

$minioContainerId = Invoke-DockerText -Arguments ($composeArguments + @("ps", "--status", "running", "-q", "minio"))
if ([string]::IsNullOrWhiteSpace($minioContainerId) -or $minioContainerId -notmatch '^[a-f0-9]{12,64}$') {
    throw "Could not resolve the running MinIO container safely. PostgreSQL backup remains at $postgresArchive"
}
$minioDirectory = Join-Path $snapshotDirectory "minio-data"
[void](New-Item -ItemType Directory -Path $minioDirectory)
[void](Invoke-DockerText -Arguments @("cp", "${minioContainerId}:/data/.", $minioDirectory))

$checksums = @(
    Get-ChildItem -LiteralPath $snapshotDirectory -File -Recurse |
        Sort-Object FullName |
        ForEach-Object {
            [ordered]@{
                path = [System.IO.Path]::GetRelativePath($snapshotDirectory, $_.FullName).Replace('\', '/')
                sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
                bytes = $_.Length
            }
        }
)
$manifest = [ordered]@{
    formatVersion = 1
    createdAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    composeFile = [System.IO.Path]::GetFileName($composePath)
    postgresFormat = "pg_dump-custom"
    minioFormat = "crash-consistent-data-directory-copy"
    restoreDrillRequired = $true
    files = $checksums
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $snapshotDirectory "manifest.json") -Encoding utf8NoBOM

Write-Warning "The backup may contain personal and clinical data. Encrypt it, restrict access, and run a restore drill before relying on it."
Write-Output "Backup created without modifying source data: $snapshotDirectory"
