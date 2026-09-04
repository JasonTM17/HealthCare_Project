# Update patient avatar URL for Nguyễn Văn An (patient@healthcare.com) in PostgreSQL
param(
    [string]$HostName = "localhost",
    [int]$Port = 5432,
    [string]$Database = "healthcare",
    [string]$User = "healthcare",
    [string]$Password = "change-me"
)

$env:PGPASSWORD = $Password
$sql = "UPDATE patient_profiles SET avatar_url = '/media/patient-male-avatar.jpg' WHERE user_id IN (SELECT id FROM users WHERE email = 'patient@healthcare.com') OR email = 'patient@healthcare.com'; SELECT u.email, p.avatar_url FROM patient_profiles p JOIN users u ON p.user_id = u.id WHERE u.email = 'patient@healthcare.com';"

& psql -h $HostName -p $Port -U $User -d $Database -c $sql
if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully updated patient avatar to /media/patient-male-avatar.jpg" -ForegroundColor Green
} else {
    Write-Error "Failed to update patient avatar in database"
}
