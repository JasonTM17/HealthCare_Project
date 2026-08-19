[CmdletBinding()]
param(
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $repositoryRoot "apps\backend"
$mavenWrapper = Join-Path $backendRoot "mvnw.cmd"

if (-not (Test-Path -LiteralPath $mavenWrapper -PathType Leaf)) {
    throw "Không tìm thấy Maven wrapper tại $mavenWrapper"
}

$env:BACKEND_PORT = $Port.ToString()
Write-Host "Đang chạy backend standalone tại http://localhost:$Port"
Write-Host "Dữ liệu được lưu tại apps\backend\data\healthcare-standalone.mv.db"
Write-Host "Nhấn Ctrl+C để dừng backend."

Push-Location $backendRoot
try {
    & $mavenWrapper spring-boot:run "-Dspring-boot.run.profiles=standalone"
    if ($LASTEXITCODE -ne 0) {
        throw "Backend kết thúc với mã lỗi $LASTEXITCODE"
    }
} finally {
    Pop-Location
}
