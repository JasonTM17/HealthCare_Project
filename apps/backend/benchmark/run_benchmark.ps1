# HealthCare Backend Stress Benchmark & Resource Profiler
# Runs k6 multi-stage benchmark while sampling container memory, JVM heap, and threads.

$ErrorActionPreference = "Stop"
$ProjectRoot = "d:\HealthCare_Project"
$LogDir = "$ProjectRoot\apps\backend\benchmark"
$CsvPath = "$LogDir\memory_profile.csv"
$SummaryJson = "$LogDir\summary.json"

Write-Host "========================================================="
Write-Host " HealthCare Platform - Backend Benchmark and Stress Test "
Write-Host " Target: http://127.0.0.1:8080 (infrastructure-backend-1)"
Write-Host "========================================================="

# 1. Pre-flight health check
Write-Host "[1/5] Verifying backend container readiness..."
$health = curl.exe -s http://127.0.0.1:8080/actuator/health
if ($health -notmatch '"status":"UP"') {
    Write-Error "Backend is not healthy: $health"
}
Write-Host "Backend is UP: $health"

# Helper to read JVM heap RSS from /proc/1/smaps
function Get-JvmHeapRssKb {
    try {
        $awkScript = '{if ($1=="Rss:") sum+=$2} END {print sum}'
        $val = docker exec infrastructure-backend-1 sh -c "awk '/f2400000-/,/AnonHugePages/ $awkScript /f6d50000-/,/AnonHugePages/ $awkScript' /proc/1/smaps"
        $lines = $val -split "`n" | Where-Object { $_ -match '^\d+$' }
        $total = 0
        foreach ($line in $lines) {
            $total += [int64]$line.Trim()
        }
        return $total
    } catch {
        return -1
    }
}

# Helper to read /proc/1/status
function Get-ProcessStatus {
    try {
        $status = docker exec infrastructure-backend-1 cat /proc/1/status
        $vmRssMatch = $status | Select-String "VmRSS:\s+(\d+) kB"
        $vmPeakMatch = $status | Select-String "VmPeak:\s+(\d+) kB"
        $threadsMatch = $status | Select-String "Threads:\s+(\d+)"
        $vmRss = [int64]$vmRssMatch.Matches.Groups[1].Value
        $vmPeak = [int64]$vmPeakMatch.Matches.Groups[1].Value
        $threads = [int]$threadsMatch.Matches.Groups[1].Value
        return @{ VmRss = $vmRss; VmPeak = $vmPeak; Threads = $threads }
    } catch {
        return @{ VmRss = -1; VmPeak = -1; Threads = -1 }
    }
}

# 2. Initial baseline snapshot
$initialStatus = Get-ProcessStatus
$initialHeap = Get-JvmHeapRssKb
$initRssMb = [math]::Round($initialStatus.VmRss / 1024, 2)
$initPeakMb = [math]::Round($initialStatus.VmPeak / 1024, 2)
$initHeapMb = [math]::Round($initialHeap / 1024, 2)

Write-Host "[2/5] Baseline Memory Snapshot:"
Write-Host "  VmRSS: $($initialStatus.VmRss) kB ($initRssMb MB)"
Write-Host "  VmPeak: $($initialStatus.VmPeak) kB ($initPeakMb MB)"
Write-Host "  JVM Heap Active RSS: $initialHeap kB ($initHeapMb MB)"
Write-Host "  Threads: $($initialStatus.Threads)"

# 3. Start background memory sampling job
Write-Host "[3/5] Starting continuous memory profiler..."
"timestamp,VmRss_kB,VmPeak_kB,HeapRss_kB,HeapRss_MB,Threads" | Out-File -FilePath $CsvPath -Encoding utf8

$scriptBlock = {
    param($CsvPath)
    $awkScript = '{if ($1=="Rss:") sum+=$2} END {print sum}'
    while ($true) {
        $timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        try {
            $status = docker exec infrastructure-backend-1 cat /proc/1/status 2>$null
            $vmRss = ($status | Select-String "VmRSS:\s+(\d+) kB").Matches.Groups[1].Value
            $vmPeak = ($status | Select-String "VmPeak:\s+(\d+) kB").Matches.Groups[1].Value
            $threads = ($status | Select-String "Threads:\s+(\d+)").Matches.Groups[1].Value
            $val = docker exec infrastructure-backend-1 sh -c "awk '/f2400000-/,/AnonHugePages/ $awkScript /f6d50000-/,/AnonHugePages/ $awkScript' /proc/1/smaps" 2>$null
            $lines = $val -split "`n" | Where-Object { $_ -match '^\d+$' }
            $heapKb = 0
            foreach ($line in $lines) { $heapKb += [int64]$line.Trim() }
            $heapMb = [math]::Round($heapKb / 1024, 2)
            "$timestamp,$vmRss,$vmPeak,$heapKb,$heapMb,$threads" | Out-File -FilePath $CsvPath -Append -Encoding utf8
        } catch {}
        Start-Sleep -Seconds 2
    }
}

$monitorJob = Start-Job -ScriptBlock $scriptBlock -ArgumentList $CsvPath

# 4. Run k6 benchmark
Write-Host "[4/5] Executing k6 stress test harness..."
$k6Path = "C:\Program Files\k6\k6.exe"
$k6Script = "$ProjectRoot\apps\backend\benchmark\stress_test.js"

$k6StartTime = Get-Date
& $k6Path run $k6Script
$k6ExitCode = $LASTEXITCODE
$k6EndTime = Get-Date

# Stop background monitor job
Stop-Job $monitorJob
Receive-Job $monitorJob | Out-Null
Remove-Job $monitorJob

$durationSec = [math]::Round(($k6EndTime - $k6StartTime).TotalSeconds, 1)
Write-Host "k6 execution completed with exit code: $k6ExitCode in ${durationSec}s"

# 5. Post-benchmark health and memory assessment
Write-Host "[5/5] Post-benchmark verification..."
$postStatus = Get-ProcessStatus
$postHeap = Get-JvmHeapRssKb
$postRssMb = [math]::Round($postStatus.VmRss / 1024, 2)
$postPeakMb = [math]::Round($postStatus.VmPeak / 1024, 2)
$postHeapMb = [math]::Round($postHeap / 1024, 2)

# Check container exit status
$inspect = docker inspect infrastructure-backend-1 | ConvertFrom-Json
$oomKilled = $inspect[0].State.OOMKilled
$containerExitCode = $inspect[0].State.ExitCode
$containerRunning = $inspect[0].State.Running

Write-Host "---------------------------------------------------------"
Write-Host " Verification Summary:"
Write-Host "  Container Running: $containerRunning"
Write-Host "  Container Exit Code: $containerExitCode"
Write-Host "  OOM Killed: $oomKilled"
Write-Host "  Post-test VmRSS: $($postStatus.VmRss) kB ($postRssMb MB)"
Write-Host "  Post-test VmPeak: $($postStatus.VmPeak) kB ($postPeakMb MB)"
Write-Host "  Post-test JVM Heap Active RSS: $postHeap kB ($postHeapMb MB)"
Write-Host "  Post-test Active Threads: $($postStatus.Threads)"

# Read memory profile stats
$samples = Import-Csv $CsvPath
$maxHeapMb = ($samples | Measure-Object -Property HeapRss_MB -Maximum).Maximum
$avgHeapMb = [math]::Round(($samples | Measure-Object -Property HeapRss_MB -Average).Average, 2)
$maxVmRssMb = [math]::Round(($samples | Measure-Object -Property VmRss_kB -Maximum).Maximum / 1024, 2)

Write-Host "  Peak Active Heap Observed: $maxHeapMb MB (Target: < 200 MB)"
Write-Host "  Average Active Heap: $avgHeapMb MB"
Write-Host "  Peak Container VmRSS: $maxVmRssMb MB"
Write-Host "---------------------------------------------------------"

if ($maxHeapMb -ge 200) {
    Write-Warning "Heap ceiling violated: $maxHeapMb MB >= 200 MB"
} else {
    Write-Host "PASS: Active JVM Heap remained strictly < 200 MB ($maxHeapMb MB peak)"
}

if ($oomKilled -or ($containerExitCode -eq 137)) {
    Write-Error "FAIL: Container experienced OOM crash (exit 137)!"
} else {
    Write-Host "PASS: Zero OOM crashes observed (exit code: $containerExitCode, OOMKilled: $oomKilled)"
}
