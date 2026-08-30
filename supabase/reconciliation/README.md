# Hosted Supabase reconciliation gate

This is an operator-reviewed, additive reconciliation plan for the currently
observed hosted target. It is documentation and evidence only; it does not
authorize a remote mutation.

## Frozen read-only target

- Project ref: `awaknzhadjglbfkhigck`
- URL: `https://awaknzhadjglbfkhigck.supabase.co`
- Observed remote migration history: `20260823085754`, `20260823085812`,
  `20260823102718`, `20260824102515`
- Local migration files: seven files under `supabase/migrations/`

The semantic mapping observed from the hosted `schema_migrations.statements`
and local SQL is:

| Hosted version | Local file | Meaning |
| --- | --- | --- |
| `20260823085754` | `20260822101722_healthcare_data_platform.sql` | catalog, mirror, and base RLS |
| `20260823085812` | `20260823123000_enforce_spring_identity_authority.sql` | Spring identity authority |
| `20260823102718` | `20260823092135_big_data_vector_contract.sql` | vector and synthetic-seed contract |
| `20260824102515` | `20260824102515_patient_chat_projection_contract.sql` | de-identified chat projection |

The mapping must be rechecked from a fresh target snapshot before any apply.
Do not rename files, rewrite `supabase_migrations.schema_migrations`, or mark
versions applied merely to make `supabase db push` appear clean.

## Why direct push is blocked

The hosted catalog tables and triggers already exist under the four hosted
versions, while the corresponding local versions differ. The first local SQL
contains unguarded `CREATE TABLE` and trigger statements, so a normal push of
all six files would collide with existing objects. The target is also missing
the local clinical columns, tombstone guard, cursor indexes, and pagination
functions, and still grants browser roles execute on `public.rls_auto_enable()`.

Therefore the safe sequence is not `db reset`, history repair, or wholesale
`db push`.

## Required evidence before a reviewed apply

An operator must attach all of the following to the release packet:

1. Exact project/ref and branch confirmation from the Supabase dashboard/CLI.
2. A named backup/PITR restore point with retention, RPO/RTO, and a completed
   restore drill. `archive_mode` alone is not backup proof.
3. A disposable branch or newly created target where the full additive plan is
   rehearsed. No branch creation is attempted if its billing confirmation is
   unavailable.
4. Fresh read-only checks of migration history, tables, columns, triggers,
   routines, policies, ACLs, extensions, and advisor lints.
5. A projection canary proving only de-identified approved rows are visible to
   `service_role`, while browser roles cannot read customer/profile/chat rows.

## Additive apply shape

After the baseline is independently confirmed, apply only the reviewed
`20260830102500_reconcile_hosted_clinical_projection_security.sql` migration.
It contains the missing end state from local migrations
`20260824113025_clinical_projection_pagination_branch_tombstones.sql` and
`20260824154423_lock_down_public_event_trigger.sql`, uses guarded catalog
checks, preserves existing rows, bounds lock/statement time, and asserts the
service-only ACL postconditions before commit. The data-only script
`supabase/tools/reconcile_chat_projection.sql` is not a substitute for this
structural migration.

Run `supabase/tests` and the read-only
`supabase/tests/hosted_reconciliation_contract.sql` against the rehearsal
target, then repeat the exact catalog/ACL queries against the hosted target.
Only after those checks pass may the service-side Supabase RAG connection be
enabled; Spring/PostgreSQL remains the transactional identity and clinical
authority throughout.

## Rollback and stop conditions

The migrations are additive and have no automatic destructive down path.
Disable Supabase consumers and restore the named backup if a canary or ACL
check fails. Stop immediately on any object collision, unexpected policy,
patient-history column, missing restore proof, or target/ref mismatch. Never
drop tables, reset the project, import real patients, or expose a database URL
to the browser.
