# Aura Health Clinical Editorial

## Creative direction

The interface is a calm Vietnamese hospital network that behaves like a trusted
care coordinator, not a generic clinic landing page. The memorable motif is the
Care Rail: symptom → specialty → doctor → appointment.

Hoan My is structural inspiration only. Do not copy its logos, brand names,
photos, doctors, addresses, phone numbers, package names, article titles,
medical claims, colors, or proprietary assets.

## Tokens

### Color

| Token | Value | Use |
| --- | --- | --- |
| `--color-canvas` | `#f9f9fc` | Page canvas |
| `--color-surface` | `#ffffff` | Content surfaces |
| `--color-surface-low` | `#f3f3f6` | Quiet section surfaces |
| `--color-surface-high` | `#e8e8ea` | Input and selected surfaces |
| `--color-ink` | `#1a1c1e` | Primary text |
| `--color-ink-muted` | `#404849` | Secondary text |
| `--color-primary` | `#003336` | Navigation and primary actions |
| `--color-primary-container` | `#004b50` | Hero and dark bands |
| `--color-mint` | `#e0f2f1` | Care and success states |
| `--color-amber` | `#7c5800` | Attention and high-value care actions |
| `--color-outline` | `#bfc8c9` | Quiet borders |
| `--color-error` | `#ba1a1a` | Errors only |

Use one neutral family and one accent voice. Never use pure black or pure white
as a text/background shortcut, neon gradients, or purple AI gradients.

### Typography

- Display and headings: `Be Vietnam Pro`, weights 600–700.
- Body and controls: `Inter`, weights 400–600.
- Body text is at least 16px with 24–28px line height.
- Use `clamp()` for editorial headings, balance headings with `text-wrap`, and
  verify Vietnamese diacritics at 375px.

### Spacing and shape

- Base scale: 4, 8, 12, 16, 24, 32, 48, 64, 80px.
- Desktop content max width: 1200px; mobile padding: 16px.
- Use 8px control radius and 16px maximum card radius.
- Buttons, fields, tabs, and icon controls have a 44px minimum touch target.

## Layout rules

- Desktop uses a 12-column grid with 64px outer margin and 24px gutters.
- Tablet uses an 8-column grid with 32px outer margin.
- Mobile uses a 4-column grid with 16px outer margin.
- Heroes are left-aligned with one primary booking action and one secondary
  catalog action. Never place trust strips, fake stats, or logo walls inside a
  hero.
- Prefer asymmetric 5/7 split sections, editorial zigzags, full-width care bands,
  and purposeful bento layouts. Do not use three equal feature cards.
- Keep one focal action per view and no more than five top-level navigation items.

## Required page states

Every data-driven page must define loading/skeleton, empty, error, unavailable,
and long-content states. Every interactive control must define default, hover,
focus-visible, active, disabled, and submitting states. Focus rings must remain
visible and body contrast must meet WCAG AA.

## Product surfaces

### Public hospital pages

Use real backend content for specialties, doctors, branches, services, packages,
articles, FAQs, and search. Label deterministic fixtures when the backend is not
available. Detail pages must preserve a clear path back to booking.

### Booking

Use a calm stepper with explicit labels, branch-aware availability, validation on
blur, a visible hold countdown, and a final electronic appointment card. Never
present a seed ID as a live catalog identity.

### AI assistant

Use a distinct mint panel with a quiet pulse only during loading. Show input
limits, loading, answer, citations, urgency, safe disclaimer, unavailable, and
retry states. The AI may recommend a specialty but never diagnoses, prescribes,
or invents doctors and slots.

### Admin CMS and realtime

Use dense but calm workspace layouts with an editorial preview beside the form.
Admin content is draft/published, validated by component type, and published via
the backend. The public page subscribes to the backend event stream, refreshes
the affected slot, shows a subtle update notice, and reconnects with backoff.

### Portals

Patient and doctor portals use the same shell but distinct information density.
Show authenticated loading, forbidden, empty, error, and unavailable states.
Never expose another patient's medical data in a fallback.

## Motion and accessibility

- State transitions: 150–250ms; modal/layout transitions: 300–500ms.
- Never use `transition: all`; honor `prefers-reduced-motion`.
- Content remains visible without animation or JavaScript choreography.
- Avoid emoji as icons; use the project's single icon family.
- Do not use em-dashes or vague AI marketing copy in visible Vietnamese UI.

## Stitch handoff

This document is the canonical implementation brief for the MCP Stitch project
`HealthCare Frontend Homepage` (`projects/1155859758694946630`). Stitch output is
reference material, not production code. Extract tokens and composition ideas,
then integrate them into the existing Next.js components and backend contracts.
