# CMS realtime content slice

This local-development slice gives an `ADMIN` a typed, versioned API for editing
frontend component slots in PostgreSQL. Public clients read only `PUBLISHED`
content and can subscribe to a bounded SSE change feed; an event carries the
slot/version/visibility metadata and the client refetches the public snapshot.
Draft payloads and content bodies are never sent through the feed.

## API contract

- `GET /api/v1/cms/content` — published snapshots for all slots.
- `GET /api/v1/cms/content/{slotKey}` — one published snapshot. A read with
  `?afterEventId=<durable-feed-cursor>` explicitly bypasses the backend's
  in-process snapshot cache and is used for heartbeat/reconnect reconciliation;
  this prevents a backend that missed Redis Pub/Sub from acknowledging a new
  cursor with stale content.
- `GET /api/v1/cms/content/events` — public SSE feed. `Last-Event-ID` or the
  `after` query parameter requests replay. Replay is capped at 50 events;
  older cursors receive `resync` and must refetch the snapshot endpoint.
- `GET /api/v1/admin/cms/content` and
  `GET /api/v1/admin/cms/content/{slotKey}` — admin draft/published views.
- `PUT /api/v1/admin/cms/content/{slotKey}` — `ADMIN`-only upsert. New slots
  require `expectedVersion: 0`; subsequent writes must send the current
  version. The response version increments on each committed edit.
- `GET /api/v1/admin/cms/content/{slotKey}/history?limit=20` — `ADMIN`-only
  versioned snapshots with actor metadata. Draft-only edits are recorded here
  but never enter the public SSE cursor.
- `POST /api/v1/admin/cms/content/{slotKey}/rollback` — `ADMIN`-only restore
  of a snapshot by `{ changeId, expectedVersion }`. Rollback is an ordinary
  new version and therefore preserves the optimistic-concurrency contract.

The allowed component types are `HERO`, `RICH_TEXT`, `CTA_BANNER`, `NOTICE`,
and `IMAGE_CARD`. Each has a fixed allow-list of scalar text fields. The
backend trims and validates those fields, rejects HTML/script/style-like input,
and accepts only relative paths or HTTPS URLs for links/images. There is no
arbitrary HTML/JS/CSS field, secret field, or patient-data field in the model.
Slot keys are also bounded to the public route inventory:
`homepage`, `about`, `branches`, `specialties`, `doctors`, `services`,
`packages`, `articles`, `careers`, `search`, `dat-lich`, `contact`, `faq`,
`huong-dan`, and `tra-cuu`, each with one of `hero`, `body`, `sidebar`, or
`footer`. Private/authenticated paths such as `admin`, `patient`, and `doctor`
cannot be persisted as public CMS slots through the API or the database
constraint.

Public responses use `Cache-Control: no-store`. The backend's small in-process
published snapshot cache is evicted and the SSE event is broadcast from an
`AFTER_COMMIT` transaction listener, including rollback because rollback creates
a new committed version. When `CMS_DISTRIBUTED_REALTIME_ENABLED=true`, the same
post-commit metadata is fanned out through Redis Pub/Sub to every backend
instance; the origin instance ignores its own broker echo. Redis carries only a
low-latency signal, never the content body: PostgreSQL's durable
`cms_content_changes` cursor remains the source for reconnect/replay, and the
SSE heartbeat includes the latest durable event cursor so the frontend can
reconcile a missed broker event even while the SSE connection remains open.
Bounded polling remains the fallback for failed reconciliation or SSE failures.
Set a unique `CMS_INSTANCE_ID` per backend instance when deploying more than
one replica. A full replay window falls back to a GET snapshot.

## Migration ordering

This checkout contains Flyway V1-V23 plus the `10.4` and `10.5` ordering
points. V10 enforces branch assignments, V10.4 first rejects a real zero-UUID
branch and cancels expired holds, V10.5 then repairs overlapping legacy
pending holds before V11 creates branch-aware scheduling constraints, V12 adds
CMS content, V13 provides an idempotent repair for volumes that already
reached V12, V14 bounds appointment OTP attempts, V15 expands structured
detail content, V16 adds actor-aware CMS audit snapshots and rollback
metadata, V17 enforces published article content, V18 hashes appointment
OTPs, V19 adds secure stored-file metadata, V20 records appointment-reminder
delivery, V21 expands patient profile details, V22 adds careers and job
applications, and V23 constrains CMS slots to public route keys. The separate
`seed-local-careers.sql` fixture runs only after V22 so older migration tests can still exercise the base seed without
referencing career tables. No migration rewrites an already-applied migration;
do not renumber these migrations on the integration head.

If an existing local volume already applied V12 before V10/V11, first verify a
database backup and then run one maintenance start with
`SPRING_FLYWAY_OUT_OF_ORDER=true`; after V10/V11 are recorded, restart with the
default `false`. This is an explicit recovery override, not the normal Compose
mode. Never use `repair` or delete `postgres-data` without reviewing the
database history and backup.

## Compose seed and verification

`infrastructure/docker-compose.yml` includes a one-shot `local-seed` service.
It mounts the seed SQL only in that service and waits for the backend health
check, which is after Flyway startup. The default is the small fictional local
seed:

```powershell
docker compose -f infrastructure/docker-compose.yml up --build
```

To choose the larger fictional dataset for a run without changing `.env`:

```powershell
$env:SEED_FILE = "../apps/backend/src/main/resources/db/seed/seed-large-data.sql"
docker compose -f infrastructure/docker-compose.yml up --build
Remove-Item Env:SEED_FILE
```

The base seed, career fixture, and rich-content overlay are idempotent. The
one-shot service applies them in that order after Flyway and backend health.
With the stack running, rerun it and verify the migration, content row, career
fixture, and uniqueness by querying from the PostgreSQL container (the command
does not print credentials):

```powershell
docker compose -f infrastructure/docker-compose.yml run --rm local-seed
docker compose -f infrastructure/docker-compose.yml exec -T postgres sh -ec 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select table_name from information_schema.tables where table_schema = ''public'' and table_name in (''cms_contents'',''cms_content_changes'') order by table_name; select slot_key, status, version, count(*) over (partition by slot_key) as rows_for_slot from cms_contents where slot_key = ''homepage.hero'';"'
```

Expected evidence is both CMS tables, one `homepage.hero` row, four active
`job_positions`, zero `job_applications`, and `rows_for_slot = 1`.
`docker compose config --quiet` is the safe config-only check before booting.
