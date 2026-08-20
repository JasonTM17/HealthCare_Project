[CmdletBinding()]
param(
    [string]$ApiBaseUrl = "http://localhost:8080/api/v1",
    [string]$FrontendUrl = "http://localhost:3000",
    [string]$DemoPassword = "LocalDemo!2026",
    [switch]$RequireClinicalFlow,
    [string]$ExpectedRevision,
    [string]$DockerPath,
    [string]$ComposeFile,
    [string]$EnvFile
)

$ErrorActionPreference = "Stop"
$checks = [System.Collections.Generic.List[string]]::new()
. (Join-Path $PSScriptRoot "local-mvp-provenance.ps1")

function Invoke-JsonApi {
    param(
        [Parameter(Mandatory)] [string]$Uri,
        [ValidateSet("GET", "POST", "PATCH")] [string]$Method = "GET",
        [object]$Body,
        [string]$Token
    )
    $parameters = @{ Uri = $Uri; Method = $Method; ContentType = "application/json" }
    if ($null -ne $Body) { $parameters.Body = $Body | ConvertTo-Json -Depth 8 }
    if ($Token) { $parameters.Headers = @{ Authorization = "Bearer $Token" } }
    Invoke-RestMethod @parameters
}

function Login-DemoRole([string]$Email) {
    $session = Invoke-JsonApi -Uri "$ApiBaseUrl/auth/login" -Method POST -Body @{
        email = $Email
        password = $DemoPassword
    }
    if (-not $session.accessToken) { throw "Login did not return an access token for $Email" }
    $checks.Add("login:$Email")
    $session.accessToken
}

function Get-HospitalBusinessDate {
    $hospitalTimeZone = [TimeZoneInfo]::FindSystemTimeZoneById("SE Asia Standard Time")
    return [TimeZoneInfo]::ConvertTime([DateTimeOffset]::UtcNow, $hospitalTimeZone).Date
}

function Get-ComposeServiceContainerId {
    param(
        [Parameter(Mandatory)] [string]$ServiceName
    )

    if ([string]::IsNullOrWhiteSpace($ComposeFile)) {
        throw "ComposeFile is required to verify image provenance without fixed container names"
    }

    $composeArgs = @("compose")
    if (-not [string]::IsNullOrWhiteSpace($EnvFile)) {
        $composeArgs += @("--env-file", $EnvFile)
    }
    $composeArgs += @("-f", $ComposeFile, "ps", "-q", $ServiceName)

    $containerOutput = & $DockerPath @composeArgs 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to resolve container for Compose service $ServiceName"
    }

    $containerId = $containerOutput | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1
    if ([string]::IsNullOrWhiteSpace($containerId)) {
        throw "Compose service $ServiceName has no running container"
    }

    return $containerId.ToString().Trim()
}

if ($ExpectedRevision) {
    if (-not $DockerPath) {
        $docker = Get-Command docker -ErrorAction SilentlyContinue
        if (-not $docker) { throw "Docker CLI is required to verify image provenance" }
        $DockerPath = $docker.Source
    }

    Assert-ExpectedRevision -Revision $ExpectedRevision
    foreach ($service in @("backend", "frontend", "ai-service")) {
        $container = Get-ComposeServiceContainerId -ServiceName $service
        Assert-ContainerRevision -ContainerName $container -Revision $ExpectedRevision -DockerExecutable $DockerPath
    }
    $checks.Add("provenance:backend+frontend+ai-service")
}

$backendHealth = Invoke-RestMethod "http://localhost:8080/actuator/health"
if ($backendHealth.status -ne "UP") { throw "Backend health is not UP" }
$frontend = Invoke-WebRequest $FrontendUrl -UseBasicParsing
if ($frontend.StatusCode -ne 200) { throw "Frontend did not return HTTP 200" }
$checks.Add("health:backend+frontend")

$adminToken = Login-DemoRole "admin@healthcare.local"
$doctorToken = Login-DemoRole "doctor@healthcare.local"
$patientToken = Login-DemoRole "patient@healthcare.local"

$specialties = Invoke-JsonApi -Uri "$ApiBaseUrl/hospital/specialties?size=100"
$doctors = Invoke-JsonApi -Uri "$ApiBaseUrl/hospital/doctors?size=100"
$branches = Invoke-JsonApi -Uri "$ApiBaseUrl/hospital/branches?size=100"
if ($specialties.totalElements -lt 1 -or $doctors.totalElements -lt 1 -or $branches.totalElements -lt 1) {
    throw "Local catalog seed is incomplete"
}
$checks.Add("catalog:seeded")

$sync = Invoke-JsonApi -Uri "$ApiBaseUrl/admin/ai/catalog/sync" -Method POST -Token $adminToken
if ($sync.status -ne "COMPLETED" -or $sync.processedDocuments -lt 1) { throw "AI catalog synchronization failed" }
$recommendation = Invoke-JsonApi -Uri "$ApiBaseUrl/ai/specialty-recommendation" -Method POST -Token $patientToken -Body @{
    symptoms = "Tôi bị đau đầu và chóng mặt"
}
if ($recommendation.specialty_resolution -ne "RESOLVED") { throw "AI specialty recommendation was not resolved against SQL catalog" }
$semantic = Invoke-JsonApi -Uri "$ApiBaseUrl/ai/search?q=$([uri]::EscapeDataString('đau đầu chóng mặt'))&top_k=5" -Token $patientToken
if (-not $semantic.results -or $semantic.results.Count -lt 1) { throw "Semantic search returned no grounded result" }
$checks.Add("ai:sync+recommendation+search")

$doctorProfile = Invoke-JsonApi -Uri "$ApiBaseUrl/doctor/profile" -Token $doctorToken
$demoDoctor = $doctors.content | Where-Object { $_.id -eq $doctorProfile.id } | Select-Object -First 1
if (-not $demoDoctor -or -not $demoDoctor.branchIds -or $demoDoctor.branchIds.Count -lt 1) {
    throw "Demo doctor is not connected to an active branch"
}
$doctorSpecialtySlug = $demoDoctor.specialtySlugs | Select-Object -First 1
$bookingSpecialty = $specialties.content | Where-Object { $_.slug -eq $doctorSpecialtySlug } | Select-Object -First 1
if (-not $bookingSpecialty) { throw "Demo doctor is not connected to an active specialty" }

$selectedDate = $null
$selectedSlot = $null
$branchId = $demoDoctor.branchIds[0]
$maxSlotOffset = if ($RequireClinicalFlow) { 0 } else { 21 }
$hospitalBusinessDate = Get-HospitalBusinessDate
for ($offset = 0; $offset -le $maxSlotOffset -and -not $selectedSlot; $offset++) {
    $candidateDate = $hospitalBusinessDate.AddDays($offset).ToString("yyyy-MM-dd")
    $slots = Invoke-JsonApi -Uri "$ApiBaseUrl/appointments/doctors/$($demoDoctor.id)/slots?date=$candidateDate&branchId=$branchId"
    $slot = $slots | Where-Object { $_.available } | Select-Object -First 1
    if ($slot) { $selectedDate = $candidateDate; $selectedSlot = $slot }
}
if (-not $selectedSlot) {
    if ($RequireClinicalFlow) {
        throw "No available slot found for the demo doctor today; the clinical lifecycle requires a same-day appointment. Retry during an available local schedule."
    }
    throw "No available slot found for the demo doctor in the next 21 days"
}

$hold = Invoke-JsonApi -Uri "$ApiBaseUrl/appointments/hold" -Method POST -Token $patientToken -Body @{
    doctorId = $demoDoctor.id
    appointmentDate = $selectedDate
    startTime = $selectedSlot.startTime
    fullName = "Bệnh nhân Local"
    phone = "0900000001"
    email = "patient@healthcare.local"
    reasonForVisit = "E2E smoke: đau đầu và chóng mặt"
    specialtyId = $bookingSpecialty.id
    branchId = $branchId
}
$confirmed = Invoke-JsonApi -Uri "$ApiBaseUrl/appointments/confirm" -Method POST -Body @{
    bookingCode = $hold.bookingCode
    otpCode = "123456"
    notes = "Automated local MVP verification"
}
if ($confirmed.status -ne "CONFIRMED") { throw "Appointment confirmation failed" }
$checks.Add("appointment:hold+otp-confirm")

$patientAppointments = Invoke-JsonApi -Uri "$ApiBaseUrl/patient/appointments?size=100" -Token $patientToken
$doctorAppointments = Invoke-JsonApi -Uri "$ApiBaseUrl/doctor/appointments?date=$selectedDate&size=100" -Token $doctorToken
$adminAppointments = Invoke-JsonApi -Uri "$ApiBaseUrl/admin/appointments?date=$selectedDate&size=100" -Token $adminToken
foreach ($view in @($patientAppointments, $doctorAppointments, $adminAppointments)) {
    if (-not ($view.content | Where-Object { $_.bookingCode -eq $confirmed.bookingCode })) {
        throw "Confirmed booking is missing from a role-specific appointment view"
    }
}
$checks.Add("appointments:patient+doctor+admin-visible")

$patientNotifications = Invoke-JsonApi -Uri "$ApiBaseUrl/notifications?size=100" -Token $patientToken
$confirmedNotification = $patientNotifications.content | Where-Object {
    $_.referenceId -eq $confirmed.id -and $_.eventType -eq "APPOINTMENT_CONFIRMED"
} | Select-Object -First 1
if (-not $confirmedNotification) {
    throw "Patient confirmation notification is missing for the confirmed booking"
}
$checks.Add("notifications:patient-confirmation-visible")

if ($RequireClinicalFlow) {
    $doctorAppointment = $doctorAppointments.content | Where-Object { $_.bookingCode -eq $confirmed.bookingCode } | Select-Object -First 1
    if (-not $doctorAppointment -or -not $doctorAppointment.patientId) {
        throw "Doctor appointment view is missing the patient identity required for the clinical flow"
    }
    $patientProfile = Invoke-JsonApi -Uri "$ApiBaseUrl/patient/profile" -Token $patientToken
    if ($doctorAppointment.patientId -ne $patientProfile.id) {
        throw "Doctor appointment patient identity does not match the authenticated patient profile"
    }

    $checkedIn = Invoke-JsonApi -Uri "$ApiBaseUrl/doctor/appointments/$($doctorAppointment.id)/status" -Method PATCH -Token $doctorToken -Body @{ status = "CHECKED_IN" }
    if ($checkedIn.status -ne "CHECKED_IN") { throw "Doctor check-in transition failed" }
    $inProgress = Invoke-JsonApi -Uri "$ApiBaseUrl/doctor/appointments/$($doctorAppointment.id)/status" -Method PATCH -Token $doctorToken -Body @{ status = "IN_PROGRESS" }
    if ($inProgress.status -ne "IN_PROGRESS") { throw "Doctor in-progress transition failed" }

    $record = Invoke-JsonApi -Uri "$ApiBaseUrl/clinical/records" -Method POST -Token $doctorToken -Body @{
        appointmentId = $doctorAppointment.id
        patientId = $patientProfile.id
        doctorId = $doctorProfile.id
        diagnosis = "E2E local verification - headache and dizziness"
        symptomsSummary = "Automated same-day clinical verification"
        treatmentPlan = "Follow the clinician's verified local care plan"
        doctorNotes = "Created by the local MVP verifier"
    }
    if ($record.appointmentId -ne $doctorAppointment.id -or $record.patientId -ne $patientProfile.id) {
        throw "Clinical record did not retain the verified appointment and patient identity"
    }
    $patientRecords = Invoke-JsonApi -Uri "$ApiBaseUrl/patient/medical-records" -Token $patientToken
    if (-not ($patientRecords | Where-Object { $_.id -eq $record.id })) {
        throw "Patient portal does not expose the newly authorized clinical record"
    }

    $completedAppointmentViews = @(
        Invoke-JsonApi -Uri "$ApiBaseUrl/patient/appointments?size=100" -Token $patientToken
        Invoke-JsonApi -Uri "$ApiBaseUrl/doctor/appointments?date=$selectedDate&size=100" -Token $doctorToken
        Invoke-JsonApi -Uri "$ApiBaseUrl/admin/appointments?date=$selectedDate&size=100" -Token $adminToken
    )
    foreach ($view in $completedAppointmentViews) {
        $completedAppointment = $view.content | Where-Object { $_.bookingCode -eq $confirmed.bookingCode } | Select-Object -First 1
        if (-not $completedAppointment -or $completedAppointment.id -ne $doctorAppointment.id -or $completedAppointment.status -ne "COMPLETED") {
            throw "Clinical record creation did not produce the verified COMPLETED appointment in every role-specific view"
        }
    }
    $checks.Add("clinical:check-in+in-progress+record+completed+own-patient-visible")
}

try {
    Invoke-JsonApi -Uri "$ApiBaseUrl/admin/appointments" -Token $patientToken | Out-Null
    throw "Patient token unexpectedly accessed the ADMIN appointment endpoint"
} catch {
    if ([int]$_.Exception.Response.StatusCode -ne 403) { throw }
}
$checks.Add("authorization:patient-denied-admin")

[pscustomobject]@{
    Status = "PASS"
    BookingCode = $confirmed.bookingCode
    AppointmentDate = $selectedDate
    ClinicalFlowRequired = [bool]$RequireClinicalFlow
    Checks = $checks -join ", "
} | Format-List
