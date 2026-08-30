# Hosted Supabase reconciliation gate

This is an operator-reviewed, additive reconciliation plan for the currently
observed hosted target. It records the gate and observed apply; it does not
authorize any future remote mutation by itself.

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

### Free-plan operator path

The selected project is intentionally kept on Supabase **Free**. Free does not
provide scheduled backups, PITR, or development branches, so those provider
signals must never be represented as `PASS`. The repository includes a bounded
operator path for a synthetic beta when the decision owner explicitly accepts
that residual recovery risk:

1. Resolve the project URL/ref with the Supabase management API and compare it
   to `awaknzhadjglbfkhigck` before sending any SQL. PostgreSQL does not expose
   the Supabase project ref to SQL; the capsule therefore also checks the
   captured cluster `pg_control_system().system_identifier` and exact migration
   statement/row fingerprints. Run `free-plan-preapply.sql` (or the exact-state
   `free-plan-reapply-preapply.sql`) as a read-only gate immediately before the
   apply. A literal `expected_project_ref` result is informational, not proof.
   This is a point-in-time gate, not a database lock: place the apply in a
   maintenance window with all projection/catalog writers stopped, and send
   the reviewed migration immediately. If a writer can run between the gate
   and `apply_migration`, capture a fresh snapshot (or produce a new atomic
   target-specific migration); do not treat a previously green gate as current.
2. Call `apply_migration` once with only
   `20260830102500_reconcile_hosted_clinical_projection_security.sql`. Do not
   concatenate that SQL with a rollback probe in one `execute_sql` request:
   the migration's terminal `COMMIT` can finalize the forward change before a
   following statement is reached.
3. Run `supabase/tests/hosted_reconciliation_contract.sql` and the read-only
   ACL/count/canary checks before enabling any Supabase RAG consumer. Keep all
   patient-chat and ingestion switches disabled until those checks pass.
4. If the exact observed five-row apply must be reverted, use
   `free-plan-rollback.sql` as a separate, newly recorded migration only after
   the URL/ref has been checked externally. Its preflight requires the captured
   cluster identifier, exact migration history and statement fingerprint,
   reviewed object definitions, and ordered `xmin`/row fingerprints; any drift
   aborts before destructive DDL. It never edits
   `supabase_migrations.schema_migrations` and restores the observed baseline
   helper ACL/comment. The checked-in file is a hardened reconstruction of the
   historical operation; its provider ledger hash identifies the earlier
   executed text, not every guard currently checked in. It is not a provider
   backup and cannot recover an independently lost project. A new apply must
   receive a new, exact rollback artifact; do not reuse this historical
   five-row procedure blindly. For a future apply, freeze the new baseline and
   run the gate first, apply while writers remain stopped, capture the
   provider's new audit row, and only then generate/verify a new compensating
   artifact before enabling consumers.

The baseline JSON is an operator evidence capsule, not a backup. It is valid
only for project ref `awaknzhadjglbfkhigck`, cluster system identifier
`7666007964130682852`, and the captured synthetic dataset. The ref check is an
operator/API gate; the SQL enforces the cluster binding and schema/data fences.
If the Free-plan manual-rollback risk is not explicitly accepted, leave the
reconciliation migration unapplied and keep consumers disabled.

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
Disable Supabase consumers and restore the named backup if one exists. On the
Free-only beta path, stop consumers and run the historical
`free-plan-rollback.sql` procedure only while its exact five-row history,
cluster identifier, object fingerprints, and row/xmin fences still match;
otherwise stop and obtain a new operator recovery decision and a newly frozen
compensating artifact.
Stop immediately on any object collision, unexpected policy, patient-history
column, missing recovery acceptance, or target/ref mismatch. Never drop tables,
reset the project, import real patients, or expose a database URL to the
browser.

## Observed hosted apply and rollback (2026-08-30)

The confirmed project is the user's Supabase **Free** project. No paid feature,
development branch, named restore point or PITR was available or enabled. A
disposable `pgvector/pg16` rehearsal and the read-only hosted contracts passed
before the provider apply. The provider then recorded the guarded
reconciliation as `20260830075505_reconcile_hosted_clinical_projection_security`.

Because `apply_migration` commits its SQL, a combined forward-plus-rollback
probe was not a valid recovery test: the migration's terminal `COMMIT` took
effect before the following rollback statements. We stopped consumers,
captured the exact post-apply state, and ran
`free-plan-rollback.sql` as a separate newly recorded migration
(`20260830075737_rollback_free_plan_reconciliation_20260830`). Its strict
watermark/object guards passed and restored the baseline columns, constraint,
trigger, indexes and functions without rewriting migration history. A separate
`free-plan-lock-down-helper.sql` migration
(`20260830080646_lock_down_public_event_trigger_free_plan_20260830`) then
restored the platform helper's service-only ACL/comment.

The checked-in rollback file has since been hardened as a review capsule. Its
hash in the provider ledger is the hash of the earlier executed statement, not
the hash of this later reconstruction; any future committed apply requires a
new snapshot and a newly generated, exact compensating artifact.

The current read-only snapshot is consequently: `articles=500`,
`specialties=30`, `faqs=150`, `ai_documents=10000`, `customers=100000`,
`patient_profiles=75000`, `ai_chat_documents=830`, branch documents `0`,
deleted chat rows `0`; reconciliation candidate columns, trigger, indexes and
pagination functions are absent; and `public.rls_auto_enable()` is owned by
`postgres`, executable only by `postgres`, with its restricted comment. The
read-only `free-plan-reapply-preapply.sql` gate passes for the exact seven-row
history, cluster identity, migration statement hashes, and row fingerprints.
This is an auditable rolled-back state, not proof that a future commit can be
recovered automatically. The historical rollback capsule is intentionally
bound to the earlier five-row state and cannot be reused for a new apply. Keep
RAG/ingestion/patient-chat consumers off until a decision owner explicitly
accepts the Free manual-rollback boundary, produces a newly frozen compensating
artifact for that apply, and reruns the hosted ACL/RLS/count/canary contract.
Never combine the forward SQL and rollback in one `execute_sql` call.
