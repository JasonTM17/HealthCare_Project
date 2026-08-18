#!/bin/sh
set -eu

run_sql() {
  psql \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --set ON_ERROR_STOP=1 \
    --file "$1"
}

# Keep this order aligned with the versions understood by Flyway. The fixture
# intentionally records no Flyway history: it is a standalone seeded database
# for local exploration, pagination, search, and performance checks.
migrations="
/opt/healthcare/migrations/V1__identity_rbac_baseline.sql
/opt/healthcare/migrations/V2__hospital_domain.sql
/opt/healthcare/migrations/V3__doctor_scheduling.sql
/opt/healthcare/migrations/V4__appointments.sql
/opt/healthcare/migrations/V5__clinical_records_and_authorization.sql
/opt/healthcare/migrations/V6__notifications.sql
/opt/healthcare/migrations/V7__appointment_slot_exclusivity.sql
/opt/healthcare/migrations/V8__appointment_pending_slot_exclusivity.sql
/opt/healthcare/migrations/V9__normalize_scheduling_and_interval_booking.sql
/opt/healthcare/migrations/V10__enforce_branch_aware_scheduling_integrity.sql
/opt/healthcare/migrations/V10.4__guard_pending_conflicts_before_repair.sql
/opt/healthcare/migrations/V10.5__repair_pending_slot_conflicts_before_constraints.sql
/opt/healthcare/migrations/V11__branch_aware_active_booking_constraints.sql
/opt/healthcare/migrations/V12__cms_content_realtime.sql
/opt/healthcare/migrations/V13__repair_legacy_pending_slot_duplicates.sql
/opt/healthcare/migrations/V14__bound_appointment_otp_attempts.sql
/opt/healthcare/migrations/V15__expand_stitch_content_contracts.sql
"

for migration in $migrations; do
  run_sql "$migration"
done

run_sql /opt/healthcare/seed/seed-large-data.sql
