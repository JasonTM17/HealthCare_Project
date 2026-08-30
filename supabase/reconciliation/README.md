# Hosted Supabase reconciliation gate

This is an operator-reviewed, additive reconciliation plan for the currently
observed hosted target. It records the gate and observed apply; it does not
authorize any future remote mutation by itself.

## Frozen read-only target

- Project ref: `awaknzhadjglbfkhigck`
- URL: `https://awaknzhadjglbfkhigck.supabase.co`
- Observed remote migration history: `20260823085754`, `20260823085812`,
  `20260823102718`, `20260824102515`, `20260830075505`,
  `20260830075737`, `20260830080646`, `20260830143140`
- Local migration files: seven files under `supabase/migrations/`

The semantic mapping observed from the hosted `schema_migrations.statements`
and local SQL is:

| Hosted version | Local file | Meaning |
| --- | --- | --- |
| `20260823085754` | `20260822101722_healthcare_data_platform.sql` | catalog, mirror, and base RLS |
| `20260823085812` | `20260823123000_enforce_spring_identity_authority.sql` | Spring identity authority |
| `20260823102718` | `20260823092135_big_data_vector_contract.sql` | vector and synthetic-seed contract |
| `20260824102515` | `20260824102515_patient_chat_projection_contract.sql` | de-identified chat projection |
| `20260830075505` | historical provider reconciliation | first guarded hosted reconciliation (later rolled back) |
| `20260830075737` | historical provider rollback | compensating rollback for the first apply |
| `20260830080646` | historical provider helper lockdown | restored the event-trigger helper ACL |
| `20260830143140` | `20260830102500_reconcile_hosted_clinical_projection_security.sql` | current writer-locked reconciliation |

The mapping must be rechecked from a fresh target snapshot before any apply.
Do not rename files, rewrite `supabase_migrations.schema_migrations`, or mark
versions applied merely to make `supabase db push` appear clean.

## Why wholesale direct push remains blocked

The hosted catalog tables and triggers already existed under four provider
versions, while the corresponding local versions differ. The first local SQL
contains unguarded `CREATE TABLE` and trigger statements, so a normal push of
the full local history would collide with existing objects. The reviewed
reconciliation has now installed the missing clinical columns, tombstone
guard, cursor indexes, pagination functions, and service-only helper ACL as a
separate eighth provider migration. That does not make wholesale history push
or repair safe.

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
4. The original observed five-row apply was reverted with
   `free-plan-rollback.sql` as a separate, newly recorded migration only after
   the URL/ref has been checked externally. Its preflight requires the captured
   cluster identifier, exact migration history and statement fingerprint,
   reviewed object definitions, and ordered `xmin`/row fingerprints; any drift
   aborts before destructive DDL. It never edits
   `supabase_migrations.schema_migrations` and restores the observed baseline
   helper ACL/comment. The checked-in file is a hardened reconstruction of the
   historical operation; its provider ledger hash identifies the earlier
   executed text, not every guard currently checked in. It is not a provider
   backup and cannot recover an independently lost project. The current
   writer-locked apply has its own exact eight-row compensating capsule,
   `free-plan-rollback-writer-lock-20260830.sql`; do not reuse the historical
   five-row procedure. That new capsule binds the cluster identifier, all
   eight provider statement hashes, object definitions/ACLs, row watermarks,
   and baseline-compatible `xmin` fingerprints. It aborts if any consumer has
   written into the new columns and preserves the already-hardened
   `public.rls_auto_enable()` ACL instead of reopening browser execution.

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
current Free-only beta path, stop consumers and use
`free-plan-rollback-writer-lock-20260830.sql` only while its exact eight-row
history, cluster identifier, statement hashes, object/ACL fingerprints, and
row/xmin fences still match. The historical `free-plan-rollback.sql` applies
only to the earlier five-row incident and must not be used against the current
state. If a fence has drifted, stop and obtain a new operator recovery decision
and a newly frozen compensating artifact.
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

That seven-row snapshot was the baseline for the later writer-locked apply
described below. It remains useful historical evidence, not the current remote
state and not proof of provider backup or automatic recovery. Never combine
the forward SQL and rollback in one `execute_sql` call.

## Current writer-locked apply (2026-08-30)

The decision owner explicitly accepted the Supabase Free manual-recovery risk
and authorized a writer-quiesced maintenance window. The forward migration was
first hardened to acquire `ACCESS EXCLUSIVE` locks on the five mutated tables
before its preflight. Commit `ccaa8a69cffb55ba71da2f9fb7f29afc73be508b`
passed the database and infrastructure contracts and all six GitHub CI jobs.
The exact seven-row `free-plan-reapply-preapply.sql` gate then returned
`FREE_PLAN_REAPPLY_PREAPPLY_OK`, and the full reviewed migration was sent once
through the provider migration API.

Supabase recorded the apply as:

- Version: `20260830143140`
- Name: `reconcile_hosted_clinical_projection_security_writer_lock_20260830`
- Statement count: `1`
- Provider statement MD5: `141b596b4ebe0867cda9a7d6a1311b82`

Post-apply evidence confirms all 33 candidate columns, four new validated
constraints, seven valid/ready indexes, three routines, and the tombstone
trigger; all 15 healthcare tables retain RLS. Browser roles cannot select the
server-only customer/profile/chat tables or execute either projection RPC;
`service_role` can execute both RPCs and the transactional list/vector canaries
each returned two rows. The hosted reconciliation contract and the
transactional tombstone negative canary both completed without error.

Counts and watermarks remain unchanged: `articles=500`, `specialties=30`,
`faqs=150`, `ai_documents=10000`, `ai_chat_documents=830`, branch documents
`0`, deleted chat rows `0`. Baseline-compatible row fingerprints still match
the frozen preapply values. Security advisors report only the five intentional
INFO notices for service-only RLS tables with no policies; no ERROR-level
advisor finding was introduced.

The exact compensating artifact is
`free-plan-rollback-writer-lock-20260830.sql`. Its parser/static contract is
covered by `test_writer_lock_rollback_contract.py`. It has not been executed:
the migration remains applied, and RAG/ingestion/patient-chat consumers remain
disabled pending the coordinated Render/backend/BFF release. This Free-plan
capsule is a bounded manual recovery operation, not PITR, a managed backup, or
a project-loss restore mechanism.
