[CmdletBinding()]
param(
    [string]$ApiBaseUrl = "http://localhost:8080/api/v1",
    [string]$FrontendUrl = "http://localhost:3000",
    [string]$AdminPassword = "LocalDev!Pass2026",
    [string]$DemoPassword = "LocalDemo!2026"
)

$ErrorActionPreference = "Stop"
$checks = [System.Collections.Generic.List[string]]::new()

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

function Login-DemoRole([string]$Email, [string]$Password = $DemoPassword) {
    $session = Invoke-JsonApi -Uri "$ApiBaseUrl/auth/login" -Method POST -Body @{
        email = $Email
        password = $Password
    }
    if (-not $session.accessToken) { throw "Login did not return an access token for $Email" }
    $checks.Add("login:$Email")
    $session.accessToken
}

$backendHealth = Invoke-RestMethod "http://localhost:8080/actuator/health"
if ($backendHealth.status -ne "UP") { throw "Backend health is not UP" }
$frontend = Invoke-WebRequest $FrontendUrl -UseBasicParsing
if ($frontend.StatusCode -ne 200) { throw "Frontend did not return HTTP 200" }
$checks.Add("health:backend+frontend")

$adminToken = Login-DemoRole "admin@healthcare.local" $AdminPassword
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
for ($offset = 0; $offset -le 21 -and -not $selectedSlot; $offset++) {
    $candidateDate = (Get-Date).Date.AddDays($offset).ToString("yyyy-MM-dd")
    $slots = Invoke-JsonApi -Uri "$ApiBaseUrl/appointments/doctors/$($demoDoctor.id)/slots?date=$candidateDate&branchId=$branchId"
    $slot = $slots | Where-Object { $_.available } | Select-Object -First 1
    if ($slot) { $selectedDate = $candidateDate; $selectedSlot = $slot }
}
if (-not $selectedSlot) { throw "No available slot found for the demo doctor in the next 21 days" }

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
    Checks = $checks -join ", "
} | Format-List
