# Stitch route matrix

This matrix is the implementation handoff for Stitch project
`1155859758694946630`. Stitch is treated as visual reference and acceptance
input; it is not copied source code or a source of fictional clinical data.

## Coverage legend

- **Live route**: an owned Next.js route exists and reads the backend contract.
- **Variant**: the same route composition at another viewport or with an
  interaction open.
- **Reference asset**: media or extracted text used for design direction, not a
  standalone user-facing route.
- **CMS live**: an admin-published typed slot can update the public surface via
  the backend change feed.

## 28 Stitch instances

| Stitch instance | Reference | Route owner | Backend / interaction | State gate |
| --- | --- | --- | --- | --- |
| `7d8eb631afd74a0996a2bed870487fe4` | Home desktop | `/` | hospital catalog, CMS `homepage.hero/body/sidebar/footer`, booking, AI | loading, empty, error, unavailable |
| `9a30734dce5b41d396c194b021c8228e` | Home variant | `/` | same home contract | same home states |
| `55dc4cc2f46c461cb7d5701df9fd9a39` | Home variant | `/` | same home contract | same home states |
| `b53e8e2738ee46f8b300393ebce155cb` | Home variant | `/` | same home contract | same home states |
| `581cbe07f0a943ec8ef743d1c9130e5e` | Home variant | `/` | same home contract | same home states |
| `d7e12f162cf449de9bd3823245cca13e` | Home full composition | `/` | same home contract | long content and responsive layout |
| `991dc0470b0a4e05b46df58bb10899da` | Home with Aura AI open | `/` | `AiTriageModal` → authenticated AI backend | input, loading, answer, citations, urgency, unavailable |
| `a02a85be30334de785bc54e31502947b` | Home mobile | `/` at mobile breakpoint | same home contract | 375px responsive/focus/overflow |
| `6f27d91e658a4d8a8a7637954ab6dc0a` | About | `/about` | doctors, specialties, branches snapshot | loading, error, no invented metrics |
| `aa57e936d1794d3d8648406ba1d23671` | Careers | `/careers` | CMS `careers.hero/body`, contact/booking actions | CMS missing/error/live update |
| `b573740942704791878cade8d1283d46` | Articles list | `/articles` | published articles API | loading, empty, error, long list |
| `7bbf57af344e450e9777ccf635a1c8a3` | Article detail | `/articles/[slug]` | published article body API | loading, 404, error, long body |
| `e5494d4c89224965a0a72481f867029e` | Article detail variant | `/articles/[slug]` | same article contract | same detail states |
| `fcfaa91229564f979f807bab36f41616` | Branch network | `/branches` | active branches API | loading, empty, error, long list |
| `faf6bffa44984304b683bb01d602d2ee` | Branch detail | `/branches/[slug]` | branch API, booking selection | loading, 404, error, no fake hotline |
| `3f1c8a04d52e43c080de4452f41f1ce4` | Specialty list | `/specialties` | active specialties API | loading, empty, error, long list |
| `a9acf90573ef44ceb76e363f99907f7f` | Cardiology detail | `/specialties/[slug]` | specialty API, related doctors, booking | loading, 404, error, long content |
| `2955a2b3fa0b4ee887493e84f4b6b172` | Obstetrics detail | `/specialties/[slug]` | same specialty contract | same detail states |
| `dcfffc74ba9c4b729324b1af01639727` | Doctor list | `/doctors` | doctors + specialty filter APIs | loading, empty, error, pagination/filter |
| `138d5b5634ff49a0a74c7193098573b9` | Package list | `/packages` | active packages API | loading, empty, error, long list |
| `f83ead2ab28f44dc8d6a2b8c915eab01` | General package detail | `/packages/[slug]` | package API, booking selection | loading, 404, error, long content |
| `466a943c39e14bd2898aaeffcb599dc4` | Cancer package detail | `/packages/[slug]` | same package contract | same detail states |
| `51b5423bdbd845d3a452596b0129dae5` | Booking flow | `/dat-lich` | branch-aware slots, hold, OTP/confirmation | validation, hold expiry, conflict, unavailable |
| `96b44d778ee34cddaa5c5b5eb32cdf80` | Search | `/search` | specialties, doctors, services, packages, articles | partial failure, empty, long results |
| `4b631e77937f42519bdf52bea65699c2` | Obstetrician portrait | reference asset | no standalone route; do not invent doctor identity | safe asset handling |
| `1990f7f7d502410b991428f085f8f0db` | Doctor/family photo | reference asset | no standalone route; current app labels demo imagery | safe asset handling |
| `fafb1fdf6bda4acea01234ef41853828` | Hoan My extracted text | handoff asset | structural inspiration only | no copied brand/content |
| `245059889506149482` | DESIGN.md | handoff asset | local canonical brief at `docs/stitch-exports/DESIGN.md` | tokens/spacing/a11y contract |

## Additional route owners

The catalog also owns `/services`, `/services/[slug]`, `/faq`, `/contact`,
`/huong-dan`, `/tra-cuu`, `/auth/login`, `/patient/dashboard`,
`/doctor/dashboard`, and the admin routes. The aliases `/bac-si/[slug]`,
`/chuyen-khoa/[slug]`, and `/goi-kham/[slug]` preserve compatibility with
legacy Vietnamese paths and redirect to the canonical route family.

All public `PublicPageShell` routes mount supplemental route-scoped `hero`,
`body`, and `sidebar` CMS slots after the native route composition so the route's
primary heading and layout remain authoritative. The shared `Footer` mounts the
route-scoped `footer` slot inside the actual site footer. The homepage and
careers page compose their live hero/body slots natively; a published HERO
component replaces the actual hero copy/image/CTA while catalog and AI actions
remain backend-owned. Admin uses `/admin/content` and optimistic
`expectedVersion` conflict handling; it never renders raw HTML or JavaScript.

## Backend contract index

| Surface | Contract |
| --- | --- |
| Catalog | `/api/v1/hospital/{specialties,doctors,branches,services,packages,articles,faqs}` |
| Booking | `/api/v1/appointments`, branch-aware slot/hold/OTP endpoints |
| CMS public | `/api/v1/cms/content/{slotKey}`, `/api/v1/cms/content/events` |
| CMS admin | `/api/v1/admin/cms/content`, versioned upsert with typed payload validation |
| AI | FastAPI service behind backend auth/token boundary; rule-based local provider in Compose |
| Persistence | Flyway PostgreSQL schema; Compose also provides Redis and MinIO for local infrastructure |

The public detail contracts are backed by Flyway V15-V22 and the local
rich-content/career overlays: specialties expose symptoms, preparation, care pathway, and related
doctors; branches expose hours, emergency hotline, map, amenities, and linked
doctors; packages expose audience, duration, checklist, and preparation; and
articles expose category, author, reading time, related specialty, and typed
sections. The rich-content assertions continue to validate the V15 contracts,
while the full base seed runs after the complete migration chain through V22
because it also contains careers fixtures.

This matrix does not claim browser, multi-instance, provider, backup/restore,
or production deployment evidence. Those remain explicit acceptance gates.
