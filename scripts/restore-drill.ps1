[CmdletBinding()]
param(
    [string]$BackupRoot = (Join-Path (Split-Path $PSScriptRoot -Parent) "backups"),
    [string]$SnapshotDirectory = "",
    [string]$PostgresImage = "postgres:16-alpine",
    [string]$MinioImage = "minio/minio:RELEASE.2025-07-23T15-54-02Z",
    [string]$DatabaseName = "healthcare",
    [string]$StorageBucket = "healthcare-files",
    [int]$MaxSnapshotAgeHours = 168
)

# Isolated restore drill (Phase 09 / HC-12). Restores the latest snapshot
# written by scripts/backup-local-data.ps1 into THROWAWAY PostgreSQL and MinIO
# containers, verifies snapshot hashes against manifest.json, checks
# relational integrity, prints RPO (snapshot age) and measured RTO, and always
# tears the throwaway containers down.
#
# Safety contract:
#   - The drill only speaks plain `docker run/cp/exec/rm`. It never invokes
#     `docker compose`, so the primary Compose project, its named volumes
#     (postgres-data/redis-data/minio-data) and its fixed ports cannot be
#     reached by construction.
#   - Containers get unique per-run GUID names and bind only ephemeral
#     loopback ports assigned by the OS, never the primary host ports.
#   - The snapshot is only ever read. MinIO starts from a scratch COPY of
#     minio-data (MinIO startup writes runtime state and must never be able to
#     mutate verified backup artifacts).
#   - Teardown runs in `finally`, so a failed integrity check still removes
#     the containers (with anonymous volumes) and the scratch workspace.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$drillStopwatch = [System.Diagnostics.Stopwatch]::StartNew()

function Invoke-DockerText {
    param([Parameter(Mandatory)][string[]]$Arguments)

    # Native stderr (image-pull progress, daemon diagnostics) must not crash
    # the drill under Windows PowerShell 5.1; the exit code stays the single
    # source of truth.
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = @(& docker @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($exitCode -ne 0) {
        $text = ($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
        throw "Docker command failed (exit $exitCode): $text"
    }
    return (($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine).Trim()
}

function Test-DockerProbe {
    param([Parameter(Mandatory)][string[]]$Arguments)

    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $null = & docker @Arguments 2>&1
        return ($LASTEXITCODE -eq 0)
    } finally {
        $ErrorActionPreference = $previousPreference
    }
}

function Wait-ThrowawayReady {
    param(
        [Parameter(Mandatory)][string[]]$ProbeArguments,
        [Parameter(Mandatory)][string]$Description
    )
    for ($attempt = 1; $attempt -le 60; $attempt++) {
        if (Test-DockerProbe -Arguments $ProbeArguments) { return }
        Start-Sleep -Seconds 2
    }
    throw "$Description did not become ready within 120 seconds."
}

function Get-FreeLoopbackPort {
    # Distinct from the primary Compose host ports (5432/5434, 9000/9001) by
    # construction: the OS assigns an unused ephemeral loopback port.
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $listener.Start()
    try {
        return $listener.LocalEndpoint.Port
    } finally {
        $listener.Stop()
    }
}

[void](Invoke-DockerText -Arguments @("version", "--format", "{{.Server.Version}}"))

$repoRoot = Split-Path $PSScriptRoot -Parent
if ($StorageBucket -notmatch '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$') {
    throw "Storage bucket name is not a valid S3/MinIO bucket identifier for restore reconciliation: $StorageBucket"
}

# ── Resolve the snapshot to drill ────────────────────────────────────────────
if ([string]::IsNullOrWhiteSpace($SnapshotDirectory)) {
    $backupRootPath = [System.IO.Path]::GetFullPath($BackupRoot)
    if (-not (Test-Path -LiteralPath $backupRootPath -PathType Container)) {
        throw "No backup directory exists at $backupRootPath. Run scripts/backup-local-data.ps1 first."
    }
    $latestSnapshot = Get-ChildItem -LiteralPath $backupRootPath -Directory -Filter "healthcare-*" |
        Sort-Object Name -Descending |
        Select-Object -First 1
    if ($null -eq $latestSnapshot) {
        throw "No healthcare-* snapshot directory exists under $backupRootPath. Run scripts/backup-local-data.ps1 first."
    }
    $snapshotPath = $latestSnapshot.FullName
} else {
    $snapshotPath = [System.IO.Path]::GetFullPath($SnapshotDirectory)
}
if (-not (Test-Path -LiteralPath $snapshotPath -PathType Container)) {
    throw "Snapshot directory does not exist: $snapshotPath"
}
$snapshotName = Split-Path $snapshotPath -Leaf

$manifestPath = Join-Path $snapshotPath "manifest.json"
$dumpPath = Join-Path $snapshotPath "postgres.dump"
$minioDataPath = Join-Path $snapshotPath "minio-data"
foreach ($requiredPath in @($manifestPath, $dumpPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Snapshot $snapshotName is incomplete: $requiredPath is missing. Refusing to drill."
    }
}
if (-not (Test-Path -LiteralPath $minioDataPath -PathType Container)) {
    throw "Snapshot $snapshotName is incomplete: $minioDataPath is missing. Refusing to drill."
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.formatVersion -ne 1) {
    throw "Unsupported snapshot manifest formatVersion '$($manifest.formatVersion)' in $manifestPath."
}
if (@($manifest.files).Count -lt 1) {
    throw "Snapshot manifest lists no files; refusing to drill."
}

# ── RPO: how much data a restore from this snapshot would lose right now ────
$snapshotCreatedAtUtc = [DateTimeOffset]::Parse(
    $manifest.createdAtUtc,
    [System.Globalization.CultureInfo]::InvariantCulture
).UtcDateTime
$snapshotAgeHours = ((Get-Date).ToUniversalTime() - $snapshotCreatedAtUtc).TotalHours
Write-Output ("RPO (snapshot age at drill start): {0:N2} hours" -f $snapshotAgeHours)
if ($snapshotAgeHours -gt $MaxSnapshotAgeHours) {
    Write-Warning ("Snapshot age {0:N2}h exceeds the {1}h RPO budget. The drill still proves restoreability, but evidence from this stale snapshot does not cover fresher data." -f $snapshotAgeHours, $MaxSnapshotAgeHours)
}

# ── Verify every snapshot file against the manifest before restoring ────────
$snapshotPrefix = [System.IO.Path]::GetFullPath($snapshotPath).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
foreach ($entry in @($manifest.files)) {
    $entryPath = [System.IO.Path]::GetFullPath((Join-Path $snapshotPath $entry.path))
    if (-not $entryPath.StartsWith($snapshotPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Manifest entry escapes the snapshot directory: $($entry.path)"
    }
    if (-not (Test-Path -LiteralPath $entryPath -PathType Leaf)) {
        throw "Manifest lists a missing snapshot file: $($entry.path)"
    }
    $actualHash = (Get-FileHash -LiteralPath $entryPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $entry.sha256) {
        throw "Snapshot integrity failure for $($entry.path): manifest sha256 $($entry.sha256) != actual $actualHash"
    }
    if ((Get-Item -LiteralPath $entryPath).Length -ne $entry.bytes) {
        throw "Snapshot byte-length failure for $($entry.path)."
    }
}
$minioSnapshotEntries = @(
    $manifest.files | Where-Object { $_.path.StartsWith("minio-data/", [System.StringComparison]::Ordinal) }
)
$stableMinioSnapshotEntries = @(
    $minioSnapshotEntries | Where-Object {
        -not $_.path.StartsWith("minio-data/.minio.sys/tmp/", [System.StringComparison]::Ordinal)
    }
)
Write-Output ("Snapshot integrity: {0} manifest files match their SHA-256 hashes ({1} MinIO files; {2} stable files checked after startup)." -f @($manifest.files).Count, $minioSnapshotEntries.Count, $stableMinioSnapshotEntries.Count)

# ── Unique drill identity and scratch workspace ─────────────────────────────
$drillId = [guid]::NewGuid().ToString("N").Substring(0, 8)
$pgContainer = "healthcare-restore-drill-$drillId-postgres"
$minioContainer = "healthcare-restore-drill-$drillId-minio"
$drillRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "infrastructure/.restore-drills"))
[void](New-Item -ItemType Directory -Path $drillRoot -Force)
$workRoot = [System.IO.Path]::GetFullPath((Join-Path $drillRoot $drillId))
if (-not $workRoot.StartsWith($drillRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar,
        [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to create a drill workspace outside $drillRoot."
}
[void](New-Item -ItemType Directory -Path $workRoot)

# Throwaway credentials are scoped to this drill's loopback-only containers.
$pgUser = "healthcare_drill"
$pgPassword = "restore-drill-local-only"
$minioRootUser = "healthcare_drill"
$minioRootPassword = "restore-drill-local-only"

try {
    # ── Throwaway PostgreSQL: restore the custom-format archive ─────────────
    $pgPort = Get-FreeLoopbackPort
    [void](Invoke-DockerText -Arguments @(
        "run", "-d", "--name", $pgContainer,
        "-e", "POSTGRES_DB=$DatabaseName",
        "-e", "POSTGRES_USER=$pgUser",
        "-e", "POSTGRES_PASSWORD=$pgPassword",
        "-p", "127.0.0.1:${pgPort}:5432",
        $PostgresImage
    ))
    Write-Output "Throwaway PostgreSQL started as $pgContainer on 127.0.0.1:$pgPort."
    Wait-ThrowawayReady `
        -ProbeArguments @("exec", $pgContainer, "pg_isready", "-U", $pgUser, "-d", $DatabaseName) `
        -Description "Throwaway PostgreSQL $pgContainer"

    [void](Invoke-DockerText -Arguments @("cp", $dumpPath, "${pgContainer}:/tmp/postgres.dump"))
    [void](Invoke-DockerText -Arguments @(
        "exec", $pgContainer, "sh", "-ec",
        'exec pg_restore --no-owner --no-privileges --exit-on-error --dbname="$POSTGRES_DB" --username="$POSTGRES_USER" /tmp/postgres.dump'
    ))
    [void](Invoke-DockerText -Arguments @("exec", $pgContainer, "rm", "-f", "/tmp/postgres.dump"))
    Write-Output "Restored postgres.dump into throwaway database $DatabaseName."
    $hasPatientDocumentsTable = (
        (Invoke-DockerText -Arguments @(
            "exec", $pgContainer, "sh", "-ec",
            "exec psql --dbname=`"`$POSTGRES_DB`" --username=`"`$POSTGRES_USER`" -At -c `"SELECT to_regclass('public.patient_documents') IS NOT NULL;`""
        )).Trim() -eq "t"
    )
    $hasPatientDocumentCleanupTable = (
        (Invoke-DockerText -Arguments @(
            "exec", $pgContainer, "sh", "-ec",
            "exec psql --dbname=`"`$POSTGRES_DB`" --username=`"`$POSTGRES_USER`" -At -c `"SELECT to_regclass('public.patient_document_object_cleanup') IS NOT NULL;`""
        )).Trim() -eq "t"
    )

    # ── Relational integrity: row counts and FK orphan checks ───────────────
    $coreTables = @("users", "patient_profiles", "doctors", "branches", "specialties", "appointments", "medical_records")
    if ($hasPatientDocumentsTable) {
        $coreTables += "patient_documents"
    }
    if ($hasPatientDocumentCleanupTable) {
        $coreTables += "patient_document_object_cleanup"
    }
    $countSelects = foreach ($table in $coreTables) {
        "SELECT '$table' AS table_name, count(*) AS row_count FROM $table"
    }
    $countQuery = ($countSelects -join " UNION ALL ") + " ORDER BY table_name;"
    $countOutput = Invoke-DockerText -Arguments @(
        "exec", $pgContainer, "sh", "-ec", "exec psql --dbname=`"`$POSTGRES_DB`" --username=`"`$POSTGRES_USER`" -At -c `"$countQuery`""
    )
    Write-Output "Restored row counts per core table:"
    foreach ($line in ($countOutput -split "`r?`n")) {
        if (-not [string]::IsNullOrWhiteSpace($line)) {
            Write-Output ("  " + ($line -replace '\|', ' = '))
        }
    }

    # The declared foreign keys should make these counts zero; a nonzero count
    # means the restore produced a torn relational state.
    $orphanChecks = [ordered]@{
        "appointments.patient_id -> patient_profiles.id" =
            "SELECT count(*) FROM appointments a LEFT JOIN patient_profiles p ON p.id = a.patient_id WHERE p.id IS NULL"
        "patient_profiles.user_id -> users.id" =
            "SELECT count(*) FROM patient_profiles pp LEFT JOIN users u ON u.id = pp.user_id WHERE pp.user_id IS NOT NULL AND u.id IS NULL"
    }
    if ($hasPatientDocumentsTable) {
        $orphanChecks["patient_documents.patient_id -> patient_profiles.id"] =
            "SELECT count(*) FROM patient_documents d LEFT JOIN patient_profiles p ON p.id = d.patient_id WHERE p.id IS NULL"
        $orphanChecks["patient_documents.generated_by -> users.id"] =
            "SELECT count(*) FROM patient_documents d LEFT JOIN users u ON u.id = d.generated_by WHERE u.id IS NULL"
    }
    foreach ($checkLabel in $orphanChecks.Keys) {
        $orphanCount = [int](Invoke-DockerText -Arguments @(
            "exec", $pgContainer, "sh", "-ec", "exec psql --dbname=`"`$POSTGRES_DB`" --username=`"`$POSTGRES_USER`" -At -c `"$($orphanChecks[$checkLabel])`""
        ))
        if ($orphanCount -ne 0) {
            throw "Referential integrity failure: $orphanCount orphan row(s) for $checkLabel."
        }
        Write-Output "Referential integrity OK: 0 orphan rows for $checkLabel."
    }

    # ── Throwaway MinIO: restore the object data from a scratch copy ────────
    $minioWorkData = Join-Path $workRoot "minio-restore"
    [void](New-Item -ItemType Directory -Path $minioWorkData)
    Copy-Item -Path (Join-Path $minioDataPath "*") -Destination $minioWorkData -Recurse -Force

    $minioPort = Get-FreeLoopbackPort
    [void](Invoke-DockerText -Arguments @(
        "run", "-d", "--name", $minioContainer,
        "-e", "MINIO_ROOT_USER=$minioRootUser",
        "-e", "MINIO_ROOT_PASSWORD=$minioRootPassword",
        "-p", "127.0.0.1:${minioPort}:9000",
        "-v", "$($minioWorkData -replace '\\', '/'):/data",
        $MinioImage, "server", "/data"
    ))
    Write-Output "Throwaway MinIO started as $minioContainer on 127.0.0.1:$minioPort."
    Wait-ThrowawayReady `
        -ProbeArguments @("exec", $minioContainer, "mc", "alias", "set", "restore", "http://127.0.0.1:9000", $minioRootUser, $minioRootPassword) `
        -Description "Throwaway MinIO alias setup for $minioContainer"
    Wait-ThrowawayReady `
        -ProbeArguments @("exec", $minioContainer, "mc", "ready", "restore") `
        -Description "Throwaway MinIO $minioContainer"

    # Verify the object data served by the restored container against the
    # snapshot manifest hashes captured by backup-local-data.ps1.
    $restoredMinioCopy = Join-Path $workRoot "minio-restored-copy"
    [void](New-Item -ItemType Directory -Path $restoredMinioCopy)
    [void](Invoke-DockerText -Arguments @("cp", "${minioContainer}:/data/.", $restoredMinioCopy))
    foreach ($entry in $stableMinioSnapshotEntries) {
        $objectRelativePath = $entry.path.Substring("minio-data/".Length)
        $restoredObjectPath = Join-Path $restoredMinioCopy ($objectRelativePath -replace '/', [System.IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path -LiteralPath $restoredObjectPath -PathType Leaf)) {
            throw "Restored MinIO is missing snapshot object file: $($entry.path)"
        }
        $restoredHash = (Get-FileHash -LiteralPath $restoredObjectPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($restoredHash -ne $entry.sha256) {
            throw "Restored MinIO object hash mismatch for $($entry.path)."
        }
    }
    Write-Output "MinIO restore: $($stableMinioSnapshotEntries.Count) stable object files verified byte-identical inside throwaway container $minioContainer."

    # ── Patient document metadata ↔ restored object reconciliation ──────────
    if ($hasPatientDocumentsTable) {
        $documentRowsQuery = "SELECT id::text, object_key, COALESCE(sha256, ''), COALESCE(byte_size, 0)::text FROM patient_documents WHERE status IN ('AVAILABLE', 'SUPERSEDED', 'REVOKED') ORDER BY id;"
        $documentRowsOutput = Invoke-DockerText -Arguments @(
            "exec", $pgContainer, "sh", "-ec",
            "exec psql --dbname=`"`$POSTGRES_DB`" --username=`"`$POSTGRES_USER`" -At -F `"`t`" -c `"$documentRowsQuery`""
        )
        $verifiedDocumentCount = 0
        foreach ($line in ($documentRowsOutput -split "`r?`n")) {
            if ([string]::IsNullOrWhiteSpace($line)) { continue }

            $columns = $line -split "`t", 4
            if ($columns.Count -ne 4) {
                throw "Could not parse restored patient_documents reconciliation row: $line"
            }
            $documentId = $columns[0]
            $objectKey = $columns[1]
            $expectedHash = $columns[2].ToLowerInvariant()
            $expectedBytes = 0L
            if ($expectedHash -notmatch '^[a-f0-9]{64}$') {
                throw "Restored patient_documents row $documentId has missing or invalid sha256 metadata."
            }
            if (-not [long]::TryParse($columns[3], [ref]$expectedBytes) -or $expectedBytes -le 0) {
                throw "Restored patient_documents row $documentId has missing or invalid byte_size metadata."
            }
            if ($objectKey -notmatch '^documents/[A-Za-z0-9._/-]+$' -or
                    $objectKey.Contains("..") -or
                    $objectKey.Contains("//") -or
                    $objectKey.Contains("\")) {
                throw "Restored patient_documents row $documentId has an unsafe object_key: $objectKey"
            }

            $objectUri = "restore/$StorageBucket/$objectKey"
            $safeDocumentId = $documentId -replace '[^A-Za-z0-9-]', '_'
            $tempObjectPath = "/tmp/document-reconcile-$safeDocumentId.bin"
            $documentCheckOutput = Invoke-DockerText -Arguments @(
                "exec", $minioContainer, "sh", "-ec",
                "rm -f `"$tempObjectPath`" && mc cat --quiet `"$objectUri`" > `"$tempObjectPath`" && sha256sum `"$tempObjectPath`" && wc -c < `"$tempObjectPath`" && rm -f `"$tempObjectPath`""
            )
            $documentCheckLines = @(
                $documentCheckOutput -split "`r?`n" |
                    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
            )
            if ($documentCheckLines.Count -lt 2) {
                throw "Could not read restored document object integrity output for patient_documents row $documentId."
            }
            $restoredObjectHash = (($documentCheckLines[0] -split '\s+')[0]).ToLowerInvariant()
            if ($restoredObjectHash -ne $expectedHash) {
                throw "Restored document object hash mismatch for patient_documents row $documentId."
            }

            $restoredBytes = [long]($documentCheckLines[1].Trim())
            if ($restoredBytes -ne $expectedBytes) {
                throw "Restored document object byte-size mismatch for patient_documents row $documentId."
            }
            $verifiedDocumentCount++
        }
        Write-Output "Document restore reconciliation PASS: $verifiedDocumentCount AVAILABLE/SUPERSEDED/REVOKED patient document object(s) match restored metadata and SHA-256."
    } else {
        Write-Output "Document restore reconciliation: patient_documents table absent in snapshot; no document metadata to verify."
    }

    $drillStopwatch.Stop()
    Write-Output ("RTO (measured restore-drill elapsed time): {0:N1} seconds" -f $drillStopwatch.Elapsed.TotalSeconds)
    Write-Output "RESTORE DRILL PASS: snapshot $snapshotName restored into disposable containers and verified. No primary data was touched."
} finally {
    foreach ($disposableName in @($pgContainer, $minioContainer)) {
        $previousPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $null = & docker rm -f -v $disposableName 2>&1
        } catch {
            # Teardown must never mask the original drill failure.
        } finally {
            $ErrorActionPreference = $previousPreference
        }
    }
    if (Test-Path -LiteralPath $workRoot -PathType Container) {
        Remove-Item -LiteralPath $workRoot -Recurse -Force
    }
}
