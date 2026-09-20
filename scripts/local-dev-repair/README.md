# Local development repair scripts

One-off SQL used to revive a **stale developer database** so the migration set
applies cleanly. They are idempotent and safe to re-run; none of them belongs in
production. Production databases receive the same rows from versioned
migrations (V56/V59/V60/V83/V86/V87) or from the admin CMS.

Why these exist: this workstation database pre-dated V69, so migrations
V69–V88 ran against a partial catalog. V84/V86/V87 assert environmental
preconditions (illustrated articles, referenced branches/doctors/packages and
doctor–branch pairs) that a fresh database already satisfies. The scripts below
restore the missing rows using **production-identical public catalog data**
(names, addresses, working hours, specialties, packages) so every invariant is
met honestly instead of weakening the migration.

Run order (against the local `healthcare` database):

| File | Purpose |
|---|---|
| `01-articles-for-v84-invariants.sql` | Restores the nine rich clinical articles that V84 embeds illustrations into (and adds the section headings its `replace()` anchors expect) so `V84`'s illustrated-count assertion passes. |
| `02-doctors-from-prod-catalog.sql` | Inserts the doctor rows referenced by V86/V87 appointments (public catalog data). |
| `03-specialties-and-branches-v1.sql` / `04-specialties-idempotent.sql` | Inserts referenced specialties and branches; `04` is the idempotent variant that suffixes a conflicting slug with `-imp`. |
| `05-doctor-branch-pairs.sql` | Creates the `(doctor_id, branch_id)` pairs required by the `fk_appointments_doctor_branch` composite key. |
| `06-packages-from-prod.sql` | Inserts the package rows referenced by V87 appointments. |

Local-only Flyway repair used alongside these (checksums for migrations whose
files changed after they were applied on this workstation only):

```sql
UPDATE flyway_schema_history SET checksum = <resolved-checksum> WHERE version = '<v>';
```

After the repair, `./mvnw spring-boot:run -Dspring-boot.run.profiles=local`
applies the remaining migrations and boots normally.
