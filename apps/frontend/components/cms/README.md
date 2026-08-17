# CMS realtime frontend boundary

This directory is the frontend adapter boundary for typed page content. The
current repository backend has legacy hospital/article CRUD, but it does not
yet expose this page/slot/version/change-feed contract. The editor and live
slot therefore use the live API only and show an explicit integration-pending
state when the contract is unavailable; they never substitute mock content.

## Contract expected by `CmsClient`

All responses are either a `CmsPage` object or `{ "data": CmsPage }`:

| Operation | Method and path | Auth | Body/query |
| --- | --- | --- | --- |
| Read published page | `GET /cms/pages/{slug}?state=PUBLISHED` | Public | — |
| Read draft page | `GET /admin/cms/pages/{slug}?state=DRAFT` | `ADMIN` | — |
| Create draft | `POST /admin/cms/pages` | `ADMIN` | `slug`, `title`, `slots`, optional `baseVersion` |
| Save draft | `PUT /admin/cms/pages/{slug}/draft` | `ADMIN` | `title`, `slots`, `baseVersion` |
| Publish | `POST /admin/cms/pages/{slug}/publish` | `ADMIN` | `baseVersion` |
| Roll back | `POST /admin/cms/pages/{slug}/rollback` | `ADMIN` | `targetVersion`, `baseVersion` |
| Published change feed | `GET /cms/pages/{slug}/changes?sinceVersion=N` | Public | SSE messages |

`CmsPage` contains `id`, `slug`, `title`, `state` (`DRAFT` or `PUBLISHED`),
positive integer `version`, ISO `updatedAt`, nullable ISO `publishedAt`, and a
`slots` map. Stable slot keys are `hero`, `body`, `sidebar`, and `footer`.
Stable component keys are `heading`, `paragraph`, `callout`, `link`, and
`image`. The renderer does not accept raw HTML or executable content.

The change feed may send `{ type, slug, version, updatedAt }` or include a
validated `page` snapshot. If EventSource is unavailable or fails, the public
slot polls the published read endpoint without reloading the page.

Set `NEXT_PUBLIC_CMS_API_BASE_URL` to the API base (including `/api/v1` when
needed). Admin calls receive a bearer token from the `CmsClient` option and
also include same-origin credentials for cookie-based sessions.

The direct editor route is `/admin/content`. A public consumer can mount
`<CmsLiveSlot slug="home" slotKey="hero" />` from `components/cms` when the
typed backend contract is available.
