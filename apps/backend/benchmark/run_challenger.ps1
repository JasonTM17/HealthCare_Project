# HealthCare Backend Concurrency & Advisory Lock Challenger Harness
# Empirically tests race conditions, HikariCP connection pool, JVM heap, and latency.

$ErrorActionPreference = "Stop"
$ProjectRoot = "d:\HealthCare_Project"
$LogDir = "$ProjectRoot\apps\backend\benchmark"
$CsvPath = "$LogDir\challenger_memory_profile.csv"
$SummaryJson = "$LogDir\challenger_summary.json"
$k6Path = "C:\Program Files\k6\k6.exe"
$k6Script = "$LogDir\challenger_race_test.js"

Write-Host "========================================================="
Write-Host " HealthCare Concurrency Challenger - Empirical Test Run  "
Write-Host " Target: http://127.0.0.1:8080 (infrastructure-backend-1)"
Write-Host "========================================================="

# 1. Pre-flight health check
Write-Host "[1/6] Verifying backend container readiness..."
$health = curl.exe -s http://127.0.0.1:8080/actuator/health
if ($health -notmatch '"status":"UP"') {
    Write-Error "Backend is not healthy: $health"
}
Write-Host "Backend is UP: $health"

# Helper for process status
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

# Helper for accurate JVM heap RSS from /proc/1/smaps across both segments
function Get-JvmHeapRssKb {
    try {
        $val = docker exec infrastructure-backend-1 sh -c 'awk ''/f2400000-/,/AnonHugePages/ {if ($1=="Rss:") sum+=$2} /f4ec0000-/,/AnonHugePages/ {if ($1=="Rss:") sum+=$2} END {print sum}'' /proc/1/smaps'
        return [int64]$val.Trim()
    } catch {
        return -1
    }
}

# 2. Baseline DB and Memory Check
Write-Host "[2/6] Baseline Check..."
$initStatus = Get-ProcessStatus
$initHeap = Get-JvmHeapRssKb
Write-Host "  Baseline VmRSS: $([math]::Round($initStatus.VmRss / 1024, 2)) MB"
Write-Host "  Baseline JVM Heap RSS: $([math]::Round($initHeap / 1024, 2)) MB"
Write-Host "  Baseline Threads: $($initStatus.Threads)"

Write-Host "  Pre-test DB Appointments for 2026-11-20:"
docker exec infrastructure-postgres-1 psql -U healthcare -d healthcare -c "SELECT booking_code, status, start_time FROM appointments WHERE doctor_id = '30000000-0000-0000-0000-000000000001' AND appointment_date = '2026-11-20' ORDER BY start_time;"

# 3. Start background memory profiler
Write-Host "[3/6] Starting 1-second continuous memory sampler..."
"timestamp,VmRss_kB,VmPeak_kB,HeapRss_kB,HeapRss_MB,Threads" | Out-File -FilePath $CsvPath -Encoding utf8

$scriptBlock = {
    param($CsvPath)
    while ($true) {
        $timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        try {
            $status = docker exec infrastructure-backend-1 cat /proc/1/status 2>$null
            $vmRss = ($status | Select-String "VmRSS:\s+(\d+) kB").Matches.Groups[1].Value
            $vmPeak = ($status | Select-String "VmPeak:\s+(\d+) kB").Matches.Groups[1].Value
            $threads = ($status | Select-String "Threads:\s+(\d+)").Matches.Groups[1].Value
            $val = docker exec infrastructure-backend-1 sh -c 'awk ''/f2400000-/,/AnonHugePages/ {if ($1=="Rss:") sum+=$2} /f4ec0000-/,/AnonHugePages/ {if ($1=="Rss:") sum+=$2} END {print sum}'' /proc/1/smaps' 2>$null
            $heapKb = [int64]$val.Trim()
            $heapMb = [math]::Round($heapKb / 1024, 2)
            "$timestamp,$vmRss,$vmPeak,$heapKb,$heapMb,$threads" | Out-File -FilePath $CsvPath -Append -Encoding utf8
        } catch {}
        Start-Sleep -Seconds 1
    }
}

$monitorJob = Start-Job -ScriptBlock $scriptBlock -ArgumentList $CsvPath

# 4. Run k6 challenger stress harness
Write-Host "[4/6] Executing k6 challenger race test harness..."
$k6StartTime = Get-Date
& $k6Path run $k6Script
$k6ExitCode = $LASTEXITCODE
$k6EndTime = Get-Date
$durationSec = [math]::Round(($k6EndTime - $k6StartTime).TotalSeconds, 1)

# Stop background monitor job
Stop-Job $monitorJob
Receive-Job $monitorJob | Out-Null
Remove-Job $monitorJob

Write-Host "k6 execution finished in ${durationSec}s with exit code: $k6ExitCode"

# 5. Post-test Container & Memory Verification
Write-Host "[5/6] Inspecting Container status & Memory metrics..."
$inspect = docker inspect infrastructure-backend-1 | ConvertFrom-Json
$oomKilled = $inspect[0].State.OOMKilled
$containerExitCode = $inspect[0].State.ExitCode
$containerRunning = $inspect[0].State.Running

$postStatus = Get-ProcessStatus
$postHeap = Get-JvmHeapRssKb

$samples = Import-Csv $CsvPath
$maxHeapMb = ($samples | Measure-Object -Property HeapRss_MB -Maximum).Maximum
$avgHeapMb = [math]::Round(($samples | Measure-Object -Property HeapRss_MB -Average).Average, 2)
$maxVmRssMb = [math]::Round(($samples | Measure-Object -Property VmRss_kB -Maximum).Maximum / 1024, 2)

Write-Host "  Container Running: $containerRunning"
Write-Host "  Container Exit Code: $containerExitCode"
Write-Host "  OOM Killed: $oomKilled"
Write-Host "  Peak Active JVM Heap: $maxHeapMb MB (Target: < 200 MB)"
Write-Host "  Avg Active JVM Heap: $avgHeapMb MB"
Write-Host "  Peak VmRSS: $maxVmRssMb MB"
Write-Host "  Post-test Threads: $($postStatus.Threads)"

# 6. Database Concurrency & Double-Booking Audit
Write-Host "[6/6] Auditing PostgreSQL for Double-Bookings & Lock Integrity..."
Write-Host "  Post-test DB Appointments for 2026-11-20:"
docker exec infrastructure-postgres-1 psql -U healthcare -d healthcare -c "SELECT booking_code, status, start_time FROM appointments WHERE doctor_id = '30000000-0000-0000-0000-000000000001' AND appointment_date = '2026-11-20' ORDER BY start_time;"

Write-Host "  Double-booking verification query across entire DB:"
$dbCheck = docker exec infrastructure-postgres-1 psql -U healthcare -d healthcare -c "SELECT doctor_id, appointment_date, start_time, count(*) FROM appointments WHERE status IN ('PENDING_CONFIRMATION', 'CONFIRMED') GROUP BY doctor_id, appointment_date, start_time HAVING count(*) > 1;"
Write-Host $dbCheck

Write-Host "========================================================="
Write-Host " CHALLENGE HARNESS COMPLETE "
Write-Host "========================================================="
