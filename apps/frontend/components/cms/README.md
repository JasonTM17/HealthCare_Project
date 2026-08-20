# CMS realtime frontend boundary

This directory consumes the integrated slot-scoped CMS contract. The backend
stores exactly one typed component per `slotKey`; it does not expose the older
page/slug, page-history, or rollback API. The frontend is live-only and never
substitutes mock content.

## Backend contract

All content responses have this shape:

```json
{
  "slotKey": "homepage.hero",
  "componentType": "HERO",
  "payload": { "title": "..." },
  "status": "PUBLISHED",
  "version": 1,
  "updatedAt": "2026-08-17T00:00:00Z"
}
```

| Operation | Method and path | Auth | Request |
| --- | --- | --- | --- |
| Public read | `GET /api/v1/cms/content/{slotKey}` | Public | — |
| Admin inventory | `GET /api/v1/admin/cms/content` | `ADMIN` | — |
| Admin read | `GET /api/v1/admin/cms/content/{slotKey}` | `ADMIN` | — |
| Admin upsert | `PUT /api/v1/admin/cms/content/{slotKey}` | `ADMIN` | `{ componentType, payload, status, expectedVersion }` |
| Realtime feed | `GET /api/v1/cms/content/events` | Public | Optional `after` query or `Last-Event-ID` header |

`componentType` is one of `HERO`, `RICH_TEXT`, `CTA_BANNER`, `NOTICE`, or
`IMAGE_CARD`. `status` is `DRAFT` or `PUBLISHED`. Every mutation is guarded
by `expectedVersion`; use `0` when creating a slot. A stale version is shown
as a conflict and is never retried automatically.

Payload fields are allowlisted by component type and must be plain strings.
Links and image URLs are limited to relative paths or HTTPS URLs. The renderer
does not accept or interpret raw HTML/JS.

The SSE endpoint emits named `ready`, `heartbeat`, `cms-content-changed`, and
`resync` events. Public slots multiplex changes through one EventSource per
`CmsClient`, filter them by backend slot key, and poll the public read endpoint
when the stream is unavailable. Reconnects use bounded exponential backoff with
jitter, and the stream closes when its last slot unmounts. A `home`
public slot maps as follows:

```tsx
<CmsLiveSlot slug="home" slotKey="hero" /> // homepage.hero
```

`PublicPageShell` places route-scoped `hero`, `body`, and `sidebar` slots in a
native three-zone public-page frame: the optional CMS hero precedes the route
composition, the route remains in its own content region, and optional
body/sidebar content is a supporting region after it. The native page heading
and domain composition remain authoritative. Only the public route families
listed in the admin editor are eligible; unknown, private, and authenticated
paths cannot create public CMS keys. The shared `Footer` mounts the
route-scoped `footer` slot inside the actual site footer.

`/careers` owns `careers.hero` and `careers.body` inside its native recruitment
composition, while the shared footer still owns `careers.footer`. Missing slots
stay hidden and do not invent page copy. Dynamic detail pages intentionally use
their top-level canonical family key (for example `doctors.hero`) so the admin
can manage a consistent collection surface; legacy Vietnamese detail aliases
redirect before this frame renders. The homepage keeps its hero/body/sidebar
slots in `app/page.tsx` and mounts `homepage.footer` through
`components/Footer.tsx`. The admin content screen offers a public route
directory plus inventory quick selections before allowing a manual slug entry.

Set `NEXT_PUBLIC_CMS_API_BASE_URL` to the API base (including `/api/v1`). Admin
requests can receive a bearer token through the `CmsClient` option and also
send same-origin credentials for cookie sessions. The direct admin editor is
available at `/admin/content`.
