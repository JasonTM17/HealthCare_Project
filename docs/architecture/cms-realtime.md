# CMS editing and realtime publication

CMS is a presentation boundary for public pages. Catalogue and clinical facts
retain their domain owners; a layout override is not authority to change a
doctor, price, article approval, or booking rule.

## Draft, publication, and recovery decisions

A **working draft** is private editorial work. A **published snapshot** is the
deliberate public release. Saving a draft or restoring history into a draft
must not change what visitors see. Keep this distinction when integrating
clients: the legacy `PUT` with `DRAFT` still means unpublish, not private save.
The new editor's restore-to-draft action is distinct from legacy rollback.

The API owner is [AdminCmsContentController](../../apps/backend/src/main/java/com/healthcare/cms/controller/AdminCmsContentController.java).
[CmsDraftService](../../apps/backend/src/main/java/com/healthcare/cms/service/CmsDraftService.java)
owns private save, explicit publish, and restore-to-draft;
[CmsContentService](../../apps/backend/src/main/java/com/healthcare/cms/service/CmsContentService.java)
owns the compatibility API and public snapshot reads. Privacy, conflict, and
legacy behavior are exercised by [CmsDraftIntegrationTest](../../apps/backend/src/test/java/com/healthcare/cms/CmsDraftIntegrationTest.java).

A conflict is a decision to reconcile another editor's work, not permission
to overwrite it silently. Inspect the latest draft before choosing whether
to retain the local edit or replace it. Save or explicitly discard dirty work
before changing pages or restoring history. The operator flow and confirmation
copy live in the [editor workspace](../../apps/frontend/components/cms/cms-editor-workspace.tsx).

## Page identity and content authority

The [native page manifest](../../apps/frontend/lib/cms-page-manifest.ts) is the
canonical route, section, editable-field, and domain-admin navigation owner.
Its [synchronizer](../../scripts/sync-cms-page-manifest.mjs) derives the backend
resource; do not maintain a second route inventory in documentation.

Detail identity uses a catalogue UUID because a slug can change. Family-level
presentation structure must not become a replacement for an individual
entity's facts. Resolve a real public entity before editing its detail page;
use the manifest's domain-admin destination for protected factual changes.
The identity boundaries are owned by [public detail navigation](../../apps/frontend/lib/cms-page-navigation.ts)
and [CmsLayoutEntityResolver](../../apps/backend/src/main/java/com/healthcare/cms/service/CmsLayoutEntityResolver.java).

Rich editing intentionally trades arbitrary HTML flexibility for a bounded
Markdown presentation model. TinyMCE is an editing surface, not an HTML or
script storage contract. Stable fields and fixed page regions preserve native
page composition when sections move. The executable limits belong to
[CmsPageLayoutValidator](../../apps/backend/src/main/java/com/healthcare/cms/service/CmsPageLayoutValidator.java)
and the [frontend layout model](../../apps/frontend/lib/cms-page-layout.ts).

## Preview boundary

Preview uses the actual public page so an administrator can assess its native
composition. It is an authorized editorial view, never a transaction surface:
booking, search, contact, feedback, and payment actions must remain inert.
Do not share a preview URL as public access to a draft or pass credentials
through iframe messages.

Authorization and rendering are owned by the [page layout provider](../../apps/frontend/components/cms/cms-page-layout-provider.tsx).
The [preview bridge](../../apps/frontend/lib/cms-preview-bridge.ts) owns exact
origin, source, channel, route, and revision checks; the
[pre-hydration guard](../../apps/frontend/public/cms-preview-guard.js) owns the
read-only preview boundary. [Next configuration](../../apps/frontend/next.config.ts)
owns the narrow self-embedding exception. Private and authentication routes
are outside the public-page editor's authority.

## Realtime authority and operational boundaries

PostgreSQL is the publication and replay authority. Redis is a wake-up path;
its availability cannot be used as proof that a client has the latest snapshot.
Public change metadata must never carry draft bodies. Reconnect and fallback
decisions belong to [CmsChangeFeedHub](../../apps/backend/src/main/java/com/healthcare/cms/service/CmsChangeFeedHub.java),
the [Redis subscriber](../../apps/backend/src/main/java/com/healthcare/cms/service/CmsChangeFeedRedisSubscriber.java),
and [client reconciliation](../../apps/frontend/lib/cms-reconciliation.mjs).
Replica configuration belongs to [CmsRealtimeProperties](../../apps/backend/src/main/java/com/healthcare/cms/config/CmsRealtimeProperties.java)
and [Compose](../../infrastructure/docker-compose.yml); give each replica a
distinct instance identity.

Use [deployment guidance](../deployment.md#cms-and-account-compatibility) for
backend-first rollout and recovery. Local seed ownership remains in
[Compose](../../infrastructure/docker-compose.yml) and
[seed resources](../../apps/backend/src/main/resources/db/seed/).
Do not repair Flyway history, delete a volume, or remove additive schema as an
automatic CMS recovery action; preserve a verified backup and inspect the
database's recorded history first. Browser fixtures and local persistence
checks are separate evidence from multi-instance or production verification.
