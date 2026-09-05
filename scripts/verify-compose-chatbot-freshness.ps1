[CmdletBinding()]
param(
    [string]$FrontendUrl = "http://localhost:3000",
    [string]$BackendHealthUrl = "http://localhost:8080",
    [string]$PublicOrigin,
    [string]$ComposeFile,
    [string]$EnvFile,
    [string]$DockerPath,
    [string]$GitPath,
    [switch]$StrictRevision
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "local-mvp-provenance.ps1")

$repoRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($ComposeFile)) {
    $ComposeFile = Join-Path $repoRoot "infrastructure/docker-compose.yml"
}
if (-not (Test-Path -LiteralPath $ComposeFile -PathType Leaf)) {
    throw "Compose file was not found: $ComposeFile"
}

if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    $candidateEnvFile = Join-Path $repoRoot ".env"
    if (Test-Path -LiteralPath $candidateEnvFile -PathType Leaf) {
        $EnvFile = $candidateEnvFile
    }
} elseif (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) {
    throw "Env file was not found: $EnvFile"
}

if ([string]::IsNullOrWhiteSpace($PublicOrigin)) {
    $PublicOrigin = ([Uri]$FrontendUrl).GetLeftPart([System.UriPartial]::Authority)
}

$DockerPath = Resolve-ExecutablePath -CommandName docker -ConfiguredPath $DockerPath
$GitPath = Resolve-ExecutablePath -CommandName git -ConfiguredPath $GitPath
$sourceRevision = Get-SourceRevision -RepositoryRoot $repoRoot -GitExecutable $GitPath
$dirtyOutput = & $GitPath -C $repoRoot status --porcelain --untracked-files=all 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect Git worktree state"
}
$dirtyEntries = @($dirtyOutput | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
$revisionIsAdvisory = $dirtyEntries.Count -gt 0 -and -not $StrictRevision
$checks = [System.Collections.Generic.List[object]]::new()

function Add-Check {
    param(
        [Parameter(Mandatory)] [string]$Name,
        [Parameter(Mandatory)] [string]$Status,
        [string]$Detail
    )

    $checks.Add([pscustomobject]@{
        name = $Name
        status = $Status
        detail = $Detail
    }) | Out-Null
}

function Get-ComposeBaseArgs {
    $composeArgs = @("compose")
    if (-not [string]::IsNullOrWhiteSpace($EnvFile)) {
        $composeArgs += @("--env-file", $EnvFile)
    }
    $composeArgs += @("-f", $ComposeFile)
    return $composeArgs
}

function Invoke-ComposeCapture {
    param(
        [Parameter(Mandatory)] [string[]]$Arguments,
        [Parameter(Mandatory)] [string]$Label
    )

    $baseArgs = Get-ComposeBaseArgs
    $output = & $DockerPath @baseArgs @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE`: $($output -join [Environment]::NewLine)"
    }
    return (($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine).Trim()
}

function Invoke-ComposeWithInput {
    param(
        [Parameter(Mandatory)] [string[]]$Arguments,
        [Parameter(Mandatory)] [string]$InputObject,
        [Parameter(Mandatory)] [string]$Label
    )

    $baseArgs = Get-ComposeBaseArgs
    $output = $InputObject | & $DockerPath @baseArgs @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE`: $($output -join [Environment]::NewLine)"
    }
    return (($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine).Trim()
}

function Get-ComposeServiceContainerId {
    param(
        [Parameter(Mandatory)] [string]$ServiceName
    )

    $containerId = Invoke-ComposeCapture -Arguments @("ps", "-q", $ServiceName) -Label "Resolve Compose service $ServiceName"
    if ([string]::IsNullOrWhiteSpace($containerId)) {
        throw "Compose service $ServiceName has no running container"
    }
    return ($containerId -split "\r?\n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1).Trim()
}

function Assert-ContainerRunningHealthy {
    param(
        [Parameter(Mandatory)] [string]$ServiceName,
        [Parameter(Mandatory)] [string]$ContainerId
    )

    $inspectOutput = & $DockerPath inspect $ContainerId 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to inspect container for service $ServiceName"
    }
    $inspect = @($inspectOutput | ConvertFrom-Json)
    $state = $inspect[0].State
    if ($state.Status -ne "running") {
        throw "Compose service $ServiceName is $($state.Status), expected running"
    }
    $health = $null
    if ($state.PSObject.Properties.Name -contains "Health" -and $null -ne $state.Health) {
        $health = $state.Health.Status
    }
    if (-not [string]::IsNullOrWhiteSpace($health) -and $health -ne "healthy") {
        throw "Compose service $ServiceName health is $health, expected healthy"
    }
    Add-Check -Name "container:$ServiceName" -Status "PASS" -Detail $(if ($health) { "running/$health" } else { "running" })
}

function Assert-ServiceRevisionFreshness {
    param(
        [Parameter(Mandatory)] [string]$ServiceName,
        [Parameter(Mandatory)] [string]$ContainerId
    )

    $inspectOutput = & $DockerPath inspect $ContainerId 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read the OCI revision label from service $ServiceName"
    }
    $inspect = @($inspectOutput | ConvertFrom-Json)
    $labels = $inspect[0].Config.Labels
    $observedRevision = ""
    if ($null -ne $labels -and $labels.PSObject.Properties.Name -contains "org.opencontainers.image.revision") {
        $observedRevision = [string]$labels."org.opencontainers.image.revision"
    }
    $observedRevision = $observedRevision.Trim()
    $matches = $observedRevision -eq $sourceRevision
    if (-not $matches -and -not $revisionIsAdvisory) {
        throw "Compose service $ServiceName is stale: label '$observedRevision' does not match HEAD '$sourceRevision'"
    }

    Add-Check `
        -Name "revision:$ServiceName" `
        -Status $(if ($matches) { "PASS" } else { "WARN" }) `
        -Detail $(if ($matches) { $sourceRevision } else { "dirty worktree; observed '$observedRevision', HEAD '$sourceRevision'" })
}

function Get-ContainerEnvValue {
    param(
        [Parameter(Mandatory)] [string]$ContainerId,
        [Parameter(Mandatory)] [string]$Name
    )

    $inspectOutput = & $DockerPath inspect $ContainerId 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to inspect container environment for $Name"
    }
    $inspect = @($inspectOutput | ConvertFrom-Json)
    foreach ($entry in @($inspect[0].Config.Env)) {
        if ($entry -like "$Name=*") {
            return $entry.Substring($Name.Length + 1)
        }
    }
    throw "Container environment is missing $Name"
}

function Assert-ChatContract {
    param(
        [Parameter(Mandatory)] [string]$Name,
        [Parameter(Mandatory)] [object]$Response
    )

    $allowedSafety = @("ANSWER", "REFUSE", "EMERGENCY", "HUMAN_HANDOFF", "INSUFFICIENT_EVIDENCE")
    $allowedProvenance = @("local_provider", "local_fallback", "remote_provider")
    if ($Response.mode -ne "HOSPITAL_SUPPORT") {
        throw "$Name returned mode '$($Response.mode)', expected HOSPITAL_SUPPORT"
    }
    if ($Response.safety_action -notin $allowedSafety) {
        throw "$Name returned unexpected safety_action '$($Response.safety_action)'"
    }
    if ($Response.provenance -notin $allowedProvenance) {
        throw "$Name returned unexpected provenance '$($Response.provenance)'"
    }
    if ([string]::IsNullOrWhiteSpace([string]$Response.answer)) {
        throw "$Name returned an empty answer"
    }
}

$serviceContainers = @{}
foreach ($service in @("backend", "frontend", "ai-service", "attachment-scanner")) {
    $containerId = Get-ComposeServiceContainerId -ServiceName $service
    $serviceContainers[$service] = $containerId
    Assert-ContainerRunningHealthy -ServiceName $service -ContainerId $containerId
    Assert-ServiceRevisionFreshness -ServiceName $service -ContainerId $containerId
}

$backendHealth = Invoke-RestMethod "$BackendHealthUrl/actuator/health"
if ($backendHealth.status -ne "UP") {
    throw "Backend host health is '$($backendHealth.status)', expected UP"
}
Add-Check -Name "host:backend-health" -Status "PASS" -Detail $BackendHealthUrl

$schemaProbe = @'
from app.schemas import ChatRequest
raise SystemExit(0 if "public_support_chat" in ChatRequest.model_fields else 42)
'@
$schemaProbeEncoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($schemaProbe))
Invoke-ComposeCapture `
    -Arguments @("exec", "-T", "ai-service", "python", "-c", "import base64; exec(base64.b64decode('$schemaProbeEncoded'))") `
    -Label "AI schema public_support_chat probe" | Out-Null
Add-Check -Name "ai-schema:public_support_chat" -Status "PASS" -Detail "ChatRequest exposes public_support_chat"

$aiServiceToken = Get-ContainerEnvValue -ContainerId $serviceContainers["backend"] -Name "AI_SERVICE_TOKEN"
$directAiBody = @{
    message = "Can you help me book a general checkup?"
    public_support_chat = $true
    recent_turns = @()
} | ConvertTo-Json -Depth 4 -Compress
$directAiBodyFile = "/tmp/codex-public-chat-smoke.json"
Invoke-ComposeWithInput `
    -Arguments @("exec", "-T", "backend", "sh", "-c", "cat > $directAiBodyFile") `
    -InputObject $directAiBody `
    -Label "Write direct AI probe payload" | Out-Null
try {
    $directResponseText = Invoke-ComposeCapture `
        -Arguments @(
            "exec",
            "-T",
            "backend",
            "wget",
            "--content-on-error",
            "-qO-",
            "--header=Content-Type:application/json",
            "--header=X-AI-Service-Token:$aiServiceToken",
            "--post-file=$directAiBodyFile",
            "http://ai-service:8000/chat"
        ) `
        -Label "Backend container direct AI token path"
} finally {
    $baseArgs = Get-ComposeBaseArgs
    & $DockerPath @baseArgs @("exec", "-T", "backend", "rm", "-f", $directAiBodyFile) 2>$null | Out-Null
}
$directResponse = $directResponseText | ConvertFrom-Json
Assert-ChatContract -Name "direct AI token path" -Response $directResponse
Add-Check -Name "direct-ai:service-token" -Status "PASS" -Detail "$($directResponse.mode)/$($directResponse.safety_action)/$($directResponse.provenance)"

$publicBody = @{
    message = "Can you help me book a general checkup?"
    recent_turns = @()
} | ConvertTo-Json -Depth 4 -Compress
$publicResponse = Invoke-RestMethod `
    -Uri "$($FrontendUrl.TrimEnd('/'))/api/v1/public/ai/chat" `
    -Method POST `
    -ContentType "application/json" `
    -Headers @{ Origin = $PublicOrigin } `
    -Body $publicBody
Assert-ChatContract -Name "same-origin BFF public chat" -Response $publicResponse
Add-Check -Name "bff:public-ai-chat" -Status "PASS" -Detail "$($publicResponse.mode)/$($publicResponse.safety_action)/$($publicResponse.provenance)"

$checkStatuses = @($checks | ForEach-Object { $_.status })
$overallStatus = if ($checkStatuses -contains "FAIL") {
    "FAIL"
} elseif ($checkStatuses -contains "WARN") {
    "DEGRADED"
} else {
    "PASS"
}

[pscustomobject]@{
    status = $overallStatus
    sourceRevision = $sourceRevision
    revisionMode = $(if ($revisionIsAdvisory) { "advisory-dirty-worktree" } elseif ($StrictRevision) { "strict" } else { "strict-clean-worktree" })
    dirtyEntries = $dirtyEntries.Count
    checks = $checks
} | ConvertTo-Json -Depth 6
