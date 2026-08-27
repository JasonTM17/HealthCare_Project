[CmdletBinding()]
param(
    [string]$EnvFile = (Join-Path (Split-Path $PSScriptRoot -Parent) ".env.production")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$envPath = [System.IO.Path]::GetFullPath($EnvFile)
if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
    throw "Production environment file does not exist: $envPath"
}

$values = @{}
foreach ($line in Get-Content -LiteralPath $envPath) {
    $trimmed = $line.Trim()
    if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#")) { continue }
    $separator = $trimmed.IndexOf('=')
    if ($separator -le 0) { continue }
    $key = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    $values[$key] = $value
}

$failures = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()
$placeholderPattern = '(?i)(^(change-me|changeme|replace-me|example|password|secret|local-development-|local-jwt-|ci-only-|your[_-])|\b(demo|placeholder|local-only)\b)'

function Get-ConfigValue([string]$Name) {
    if ($values.ContainsKey($Name)) { return [string]$values[$Name] }
    return ""
}

function Require-Value([string]$Name) {
    $value = Get-ConfigValue $Name
    if ([string]::IsNullOrWhiteSpace($value)) {
        $failures.Add("$Name is required.")
        return ""
    }
    if ($value -match $placeholderPattern) {
        $failures.Add("$Name still uses a placeholder.")
    }
    return $value
}

function Require-Secret([string]$Name, [int]$MinimumLength) {
    $value = Require-Value $Name
    if ($value.Length -gt 0 -and $value.Length -lt $MinimumLength) {
        $failures.Add("$Name must contain at least $MinimumLength characters.")
    }
}

function Require-Boolean([string]$Name, [bool]$Expected) {
    $value = (Get-ConfigValue $Name).ToLowerInvariant()
    $expectedValue = $Expected.ToString().ToLowerInvariant()
    if ($value -ne $expectedValue) {
        $failures.Add("$Name must be $expectedValue for production.")
    }
}

$profile = Require-Value "SPRING_PROFILES_ACTIVE"
if ($profile -match '(?i)(^|,)(test|standalone|local)(,|$)') {
    $failures.Add("SPRING_PROFILES_ACTIVE must not enable test, standalone, or local profiles in production.")
}
Require-Secret "JWT_SECRET" 32
Require-Secret "POSTGRES_PASSWORD" 16
if (-not [string]::IsNullOrWhiteSpace((Get-ConfigValue "DATABASE_PASSWORD"))) {
    Require-Secret "DATABASE_PASSWORD" 16
}
Require-Secret "MINIO_ROOT_PASSWORD" 16
Require-Secret "AI_SERVICE_TOKEN" 32
Require-Boolean "STORAGE_AV_REQUIRED" $true
[void](Require-Value "STORAGE_AV_SERVICE_URL")
Require-Secret "STORAGE_AV_SERVICE_TOKEN" 32
Require-Boolean "APP_BOOKING_ALLOW_TEST_OTP" $false
Require-Boolean "APP_SECURITY_RATE_LIMIT_ENABLED" $true
# Patient-chat egress is a separate production kill switch. A provider key or
# DeepSeek URL must never turn it on accidentally.
Require-Boolean "AI_PATIENT_CHAT_REMOTE_ENABLED" $false
Require-Boolean "AI_CHAT_REMOTE_PROVIDER_ENABLED" $false
Require-Boolean "REMOTE_AI_KILL_SWITCH" $true
Require-Boolean "REMOTE_AI_SYNTHETIC_ONLY" $true
Require-Boolean "SUPABASE_RAG_FALLBACK_TO_MEMORY" $false

$origins = Require-Value "CORS_ALLOWED_ORIGINS"
foreach ($origin in ($origins -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })) {
    if (-not $origin.StartsWith("https://", [System.StringComparison]::OrdinalIgnoreCase) -or
            $origin -match '(?i)(localhost|127\.0\.0\.1|\*)') {
        $failures.Add("CORS_ALLOWED_ORIGINS must contain only explicit HTTPS production origins.")
        break
    }
}

Require-Boolean "APP_MAIL_ENABLED" $true
$mailHost = Require-Value "SPRING_MAIL_HOST"
if ($mailHost -match '(?i)^(localhost|mailpit|127\.0\.0\.1)$') {
    $failures.Add("SPRING_MAIL_HOST must not point to the local Mailpit service in production.")
}
[void](Require-Value "APP_MAIL_FROM")
Require-Boolean "SPRING_MAIL_SMTP_AUTH" $true
Require-Boolean "SPRING_MAIL_STARTTLS_ENABLE" $true
Require-Boolean "SPRING_MAIL_STARTTLS_REQUIRED" $true
[void](Require-Value "SPRING_MAIL_USERNAME")
Require-Secret "SPRING_MAIL_PASSWORD" 16

$paymentEnabled = (Get-ConfigValue "APP_PAYMENT_BANK_TRANSFER_ENABLED").ToLowerInvariant()
if ($paymentEnabled -eq "true") {
    [void](Require-Value "PAYMENT_BANK_NAME")
    [void](Require-Value "PAYMENT_BANK_ACCOUNT_HOLDER")
    $bankBin = Require-Value "PAYMENT_BANK_BIN"
    if ($bankBin -notmatch '^\d{6}$') { $failures.Add("PAYMENT_BANK_BIN must contain exactly 6 digits.") }
    $bankAccount = Require-Value "PAYMENT_BANK_ACCOUNT"
    if ($bankAccount -notmatch '^\d{6,20}$') { $failures.Add("PAYMENT_BANK_ACCOUNT must contain 6 to 20 digits.") }
    $amount = Get-ConfigValue "PAYMENT_DEFAULT_AMOUNT"
    if ($amount -notmatch '^\d+$' -or [decimal]$amount -le 0) {
        $failures.Add("PAYMENT_DEFAULT_AMOUNT must be a positive whole-number VND amount.")
    }
    Require-Secret "PAYMENT_WEBHOOK_SECRET" 32
    $tolerance = Get-ConfigValue "PAYMENT_WEBHOOK_TOLERANCE_SECONDS"
    if ($tolerance -notmatch '^\d+$' -or [int]$tolerance -lt 60 -or [int]$tolerance -gt 900) {
        $failures.Add("PAYMENT_WEBHOOK_TOLERANCE_SECONDS must be between 60 and 900.")
    }
} elseif ($paymentEnabled -eq "false") {
    $warnings.Add("Bank-transfer payment is disabled; no payment webhook will be accepted.")
} else {
    $failures.Add("APP_PAYMENT_BANK_TRANSFER_ENABLED must be true or false.")
}

if ((Get-ConfigValue "RAG_INGEST_ENABLED").ToLowerInvariant() -eq "true") {
    Require-Secret "RAG_INGEST_TOKEN" 32
}

foreach ($warning in $warnings) { Write-Warning $warning }
if ($failures.Count -gt 0) {
    Write-Error ("Production environment validation failed:`n - " + ($failures -join "`n - "))
    exit 1
}

Write-Output "Production environment contract passed. Secret values were not printed."
