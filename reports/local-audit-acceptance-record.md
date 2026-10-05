# HealthCare Local Audit — Acceptance Record

**Frozen HEAD:** `20cfdbbebae23cc1e2bed5f87b89b7d1a9f2a3c9` (local `main` only — not pushed)
**Review chain state:** all review waves resolved; last confirmation review PASS on the frozen tree.
**Status:** CONDITIONALLY ACCEPTED LOCALLY — see gate items and residuals below. Production NOT touched.

## Commit chain (local, unpushed)

| Commit | Content |
|---|---|
| `b5a99e5` | Chatbot deterministic amenity/preparation lanes + clinical guardrail hardening |
| `ccba166` | Remediation wave 1 — rate limits, doc revalidation, parser bounds, media lifecycle, editor integrity |
| `cbf2a56` | Wukong falsification wave — encoded-path/HEAD bypass, doc TOCTOU, parser NBSP/dialect, multi-role, PDF fail-closed |
| `baf5ffa` | Wave-3 — cover clear semantics, escaped-pipe tables, entity bounds, URL backslash, re-open fidelity |
| `20cfdbb` | Wave-4 — post-fetch stream finally-close, second-refresh deny tests, packet anchor repair |

## Evidence ledger

| Gate | Status | Artifact |
|---|---|---|
| Backend focused suites (6 classes) | PASS 108/108 | reports/local-audit-final-gate-suites.txt |
| Frontend node suites (editor round-trip + safety) | PASS 48/48 | node --test run |
| Frontend tsc --noEmit | PASS | — |
| Frontend production build (67 pages) | PASS | docker build log |
| Backend image rebuild (wave-4) | PASS | image 62bae7b3… |
| git diff --check + secret scan | PASS | — |
| Live E2E booking journey (UI→patient/doctor/admin) | PASS 40.1s | reports/local-audit-live-e2e-wave34.txt |
| Live E2E PDF 3-class + byte/SHA-256 + scope | PASS 14.6s | same |
| Live E2E CMS hero publish→public→rollback→public | PASS 2.1m | same |
| Live E2E appointment lifecycle (hold→OTP→confirm→reschedule→double-book 409→cancel) | PASS 2.6s | same |
| Attachment upload + AV scan CLEAN | PASS | inside booking test |
| Rate-limit live probes (encoded/HEAD/plain →429 @61) | PASS | same file notes |
| Chatbot public lane probes | PASS 24/24 | reports/local-audit-ai-review-packet-v5.json era |
| Kongming / Wukong / final-review / editor-deep-review | resolved | reviewer reports in conversation |
| Confirmation review on 20cfdbb | PASS 10/10, no new defects | bb62bb87 report |

## Residual risks (documented, not silently dropped)

1. **Document stream TOCTOU** — narrowed to: post-fetch revalidation + try/finally close + deny audit. Bytes could still be consumed by a stream fetched microseconds before a revoke commit. Acceptable risk for current threat model; atomic revocation-aware storage would require object-store-level conditional fetch (not available in MinIO S3 API).
2. **Media orphan coverage** — inline article-body `![](media/{id})` removals, failed-save-after-upload assets, admin catalog covers, and CMS slot images have no cleanup UI/path (DELETE API exists). Bounded by 20/day upload quota; orphans accumulate in MinIO only.
3. **Doctor photoUrl cannot be cleared** — `DoctorService` deliberately ignores blanks. The FE "Gỡ ảnh" affordance on doctor profile silently no-ops on the server (no wrong-delete since diff uses server echo). Decision needed: expose clear semantics or hide the button.
4. **Rate-limit decode parity** — rules match on servlet path after single %XX decode; deployment under a non-root `server.servlet.context-path` would silently miss specific buckets (catch-all POST still applies). Assert empty context-path at deploy time.
5. **NAT/shared-IP false positives** on public buckets — accepted product trade-off; buckets sized for clinic-scale traffic.
6. **`DOCUMENT_GENERATION_ENABLED` ↔ media uploads coupling** — feature-flag coherence remains a readiness item.
7. **Admin catalog coverImageUrl free-text** — not URL-validated; impact bounded by CSP `img-src` allowlist (broken image at worst).
8. **Media GET `Content-Disposition: inline` without `nosniff`** — declared image MIME + magic-byte check; modern browsers do not sniff image/* to HTML. Optional hardening.
9. **Chatbot accepted edges** — `xe đạp đỏ`/`ô tô đỏ` (đỏ≠đỗ nonsense-input ambiguity), `đau, xe máy để ở đâu` → benign navigation fallback.
10. **Checklist re-open degradation** — stored `- [ ]` items degrade to `☐/☑` marker bullets in TinyMCE (honest, not a round-trip checkbox widget).

## NOT_RUN / gated

- **Production anything** — Supabase migrations, Render deploy verify, Vercel deploy verify, hosted chatbot, real payment rails, public CMS render on prod, deployment digest checks. All gated on explicit user acceptance + credentials via Windows env.
- **Push/PR/CI** — local commits only; no remote push performed or authorized.
- **Cross-platform** — Windows-only verification; Linux/macOS not exercised.
- **Doctor-lane live probe on final image** — unit-pinned + shared code paths; the earlier 13/13 patient-lane live pass predates only mechanical changes.

## Wave-5 addendum — clinical + payment decision coverage (HEAD 5d44a1d)

New live E2E spec `tests/e2e/live-compose-clinical-payment.spec.ts` closes the two
coverage gaps flagged by the test-evidence audit, all on the same-origin
`:3330` BFF stack with real Mailpit/Redis/MinIO:

| Journey | Status | Evidence |
|---|---|---|
| Doctor clinical: hold→OTP→confirm→CHECKED_IN→IN_PROGRESS→medical record+prescription→COMPLETED (both portals)→patient record→VISIT_SUMMARY PDF bytes+SHA-256 | PASS | playwright list output, 3/3 green |
| Payment reject: submit→PENDING_VERIFICATION→admin PATCH REJECT→patient sees REJECTED+rejectionReason | PASS | same run |
| Payment refund: submit→VERIFY→PAID→owner cancel→REFUND_PENDING→admin refund→REFUNDED | PASS | same run |

Incidental live confirmation: the hold layer's cross-branch occupancy guard
correctly returns 409 when the doctor already occupies a start time at a
different branch (first expanded-branch selection attempt hit it).

Fixture note: the demo doctor's same-day schedule has finite capacity; repeat
runs consume slots. The spec reports BLOCKED_SAME_DAY_CLINICAL_FIXTURE loudly
rather than skipping silently when exhausted.

Still NOT_RUN on this snapshot: stale/concurrent double-decision on the same
payment (backend guarded by status transition, unit-covered); admin UI-level
(browser page object) journey remains demonstrated by live-compose-demo UI
test for approve; reject/refund UI clicks are API-level here.

### Wave-5b — consolidated suite + stale-decision guard

Fourth journey added to the spec: double admin decision on the same payment is
refused (4xx, terminal state preserved). Full live-compose suite consolidated:
8/8 PASS across two batches (auth rate-limit bucket sizing forces serial
batching — environment constraint, not a product defect).

| Spec | Status |
|---|---|
| live-compose-demo (booking+attachment+AV, PDF 3-class+scope, CMS hero publish/rollback) | PASS 3/3 |
| live-compose-clinical-payment (doctor journey, reject, refund, stale-decision) | PASS 4/4 |
| live-compose-lifecycle (hold→OTP→confirm→reschedule→double-book 409→cancel) | PASS 1/1 |

## Wave-6 addendum — responsive/a11y/chatbot remediation (HEAD f4196f4)

Two-commit remediation of the 10-issue screenshot audit plus the specialist
findings on top of it. Evidence re-run on freshly rebuilt audit images
(`Dockerfile.prebuilt` packages host-built artifacts because the in-image
Turbopack/Maven builds repeatedly crashed the WSL2 Docker engine).

Commit `b482fa1` — UI/a11y/chatbot audit remediation:
- article reading-toolbar wrap + admin grid `min-width:0` (320px overflow gone)
- CSP `upgrade-insecure-requests` moved to build ARG (`CSP_UPGRADE_INSECURE_REQUESTS`)
  — Next.js bakes `headers()` into `routes-manifest.json`; runtime env had no effect
- `chat-policy` now returns `enabledModes`; pickers disable unlisted clinical modes
- landmark labels unique; utility-bar is a named region; touch targets ≥44px

Commit `f4196f4` — Wukong/Kongming findings:
- fail-closed `modeAvailable`: absent `enabledModes` disables clinical modes
  (picker + existing-conversation composer + retry + suggestion chips +
  `sendContent`/`handleSend` defense-in-depth + dormant public-assistant open path)
- `PublicSpecialtyTriageService`: emergency check precedes the enabled-flag
  rejection (F4 ordering invariant, was: 503 swallowed crisis guidance)
- test cleanup → `deleteAllInBatch` (JPA remove+insert flush order collided
  with V86 fixture slugs); triage tests moved onto the Redis-backed base
- `Dockerfile.prebuilt` pair + doc row for the CSP build arg

| Check | Result | Artifact |
|---|---|---|
| UI verify probe (overflow/landmarks/touch/CSP/axe/modes) | 24/24 PASS | `reports/local-audit-uiux-verify.json` |
| Flags-off mode lockdown (picker, persisted conversation, retry/suggestion, floating) | 13/13 PASS | `reports/local-audit-flags-off-modes.json` |
| AiConversationIntegrationTest | 40/40 | surefire |
| PublicSpecialtyTriageIntegrationTest + Disabled | 6/6 + 2/2 | surefire |
| tsc --noEmit (frontend) | clean | — |
| flags-on patient triage e2e (earlier image, same code path) | 6/6 | streamed answer rendered |
| WebKit 26.5 spot (home/articles/search @375) | 4/4 | probe-webkit-spot.mjs output |
| Public emergency triage via BFF on new image | 200 EMERGENCY + 115 | live curl |

Residual decisions carried: media-orphan reaper design proposal pending;
doctor photoUrl clear semantics; non-loopback HTTP remains unsupported for
authenticated features (`Secure`/`__Host-` cookies need HTTPS or loopback —
documented limitation, not a defect).

## Wave-7 addendum — emergency-first ordering + Vietnamese lexicon precision (HEAD e631fb5)

Three-commit safety wave driven by reviewer findings (reviewer CHANGES_REQUESTED,
Wukong FALSIFIED INV-004, Kongming CONDITIONAL). The emergency invariant now
holds on every entry lane: crisis detection precedes length/control-char
validation, the education kill-switch, deterministic shortcuts, consent/mode/
credit gates (authenticated lane keeps ownership + idempotency), and the
provider is never invoked for crisis input.

Commit `44666c6` — create-path + kill-switch residuals:
- guest education lane honors AI_CHAT_HEALTH_EDUCATION_ENABLED (was bypassed)
- "Tạo mới"/"Lưu mặc định"/floating open-event all gate on effective mode
- public lexicon gained tự tử/muốn chết/tự sát phrase forms

Commit `d60cca3` — emergency-first ordering + bounded scanning:
- crisis check moved before length validation (public) and mode/consent/credit
  (authenticated); overlong crisis → EMERGENCY not 400
- EMERGENCY_SCAN_LIMIT=4096 bounds normalization; BFF mirrors it
- lexicon precision round 1: idiom-bound "tu tu", laundry-excluded "co giat"

Commit `5243427` — folded-Vietnamese false-positive removal (all 3 lexicons):
- benign "từ từ"/"có giặt (ủi/là/giũ/gì/đồ)" no longer raise the 115 banner;
  squashed nets re-apply the same exclusions (cogiat laundry prefix,
  tutu intent compounds)

Commit `e631fb5` — adversarial-review counterexamples closed:
- "co giat do sot cao" fires again ("do"=because-of kept via medical
  lookahead); joined "tututroi" fires via word-initial prefix rule;
  "nghỉ ngơi từ từ" and joined "tututhoi" stay benign; volition markers
  gained se|sap|dang; PROTECTED_INPUT_CUE precision mirrors the emergency
  cue; BFF fallback now fires on any lease-open non-2xx and scans 4096;
  mode classification bounded; CONSENT_TEXT discloses duty-of-care
  crisis persistence.

| Check | Result | Artifact |
|---|---|---|
| PublicAiChatControllerTest | 71/71 | surefire (incl. window-boundary tests) |
| AiConversationIntegrationTest | 42/42 | surefire (Testcontainers) |
| PublicSpecialtyTriage{,Disabled}IntegrationTest | 6/6 + 2/2 | surefire |
| ai-service pytest (all) | 945/945 | pytest |
| bff-security.test.mjs | 40/40 | node --test |
| Live matrix on rebuilt images (18 rows) | all correct | BFF :3330 → backend :8180 → ai-service |

Live matrix highlights (all on e631fb5 images): overlong-crisis→EMERGENCY,
overlong-normal→400, "từ từ"/"giặt ủi/giũ/đồ"/"nghỉ ngơi từ từ"/joined
"tututhoi"→ANSWER (provider-free), "muốn/sẽ/nghĩ đến việc tự tử"+"tututroi"+
"co giật do sốt cao"→EMERGENCY, education kill-switch→safe ANSWER degrade.

Documented residuals (accepted, not silently dropped):
- `AI_EMERGENCY_KEYWORD_RECALL=baseline` intentionally restores pre-precision
  legacy vocabulary (kill switch = restore old behavior, warts included).
- Java/BFF lexicons are a precision subset of Python's tiered engine —
  provider-up path masks narrower gate recall; outage fallback carries the
  hotline CTA regardless.
- Bare third-person/informational self-harm mentions ("anh ấy tự tử")
  intentionally silent — stated-intent contract.
- "có giặt không?" (no noun) still over-fires — ambiguous = safe-side.
- SSE lane EMERGENCY arrives inside the `done` event (HTTP 200) — wire
  shape shares the same gated path; browser banner render unverified by
  automated browser test (contract-covered at API level).

## Addendum — post-e631fb5 delta

Wave-9 changes since `e631fb5`, committed as `4dd52f6` (local `main`,
not yet pushed):

1. **CE-NEW-1 fail-safe reversal (Wukong wave-9).** `co giat do <X>` laundry
   suppression inverted across all 4 detectors: `do` now only counts as the
   "đồ/laundry" sense when followed by a clause-end or laundry particle
   (không/ko/ạ/hả/nhé…); any other continuation — e.g. "bé co giật do bị
   ngã", "co giật do sốt cao" — fires EMERGENCY. Closed-world medical
   allowlist removed; default is fail-safe fire. Laundry-particle boundary
   widened `\W`-based so "có giặt đồ!" (punctuation) still suppresses.
2. **Deterministic public-chat lanes expanded.** BOOKING / CATALOG / DOCTOR
   intents now resolve through `publicCatalogFallback` /
   `publicNavigationCopy` (live catalog data where available) instead of a
   3–8s provider round trip — measured 0.03–0.35 s through the full local
   BFF→backend chain.
3. **Trust gate moved ahead of deterministic lanes.** Ordinary requests now
   pass `BffRequestVerifier.isTrusted` before any deterministic shortcut —
   closing the wave-8 gap where fast lanes bypassed the BFF credential
   check. Emergency handling remains deliberately fail-open ahead of the
   gate. Live: untrusted direct calls rejected 403 at the servlet filter
   for deterministic-lane, greeting and emergency messages alike.
4. **BFF lease-open 4xx regression pinned.** New test: `/open` returning
   403/400 degrades a crisis message to the emergency-safe fallback
   (EMERGENCY + tel:115), never reaches the provider.
5. Dead `PUBLIC_AI_FALLBACK_STATUSES` set removed (upstream `>=500` clause
   subsumed it); same-origin pin updated to the surviving predicate.
6. Parity comments corrected: Java/BFF joined-`tutu` fires at any token
   start (broader than Python's stream-start-only rule — over-fire, safe
   side); the previous comment claimed identical semantics.

| Check | Result | Artifact |
|---|---|---|
| PublicAiChatControllerTest | 73/73 | surefire |
| PublicAiChatIntegrationTest | 6/6 | surefire (Testcontainers) |
| AiConversationIntegrationTest | 42/42 | surefire (Testcontainers) |
| PublicSpecialtyTriage{,Disabled}IntegrationTest | 7/7 + 4/4 | surefire (Testcontainers) |
| ai-service pytest (all) | 955/955 | pytest |
| bff-security.test.mjs | 41/41 | node --test |
| same-origin-api.test.mjs | 10/10 | node --test |
| Live matrix on rebuilt images | all correct | BFF :3330 → backend :8180 → ai-service |

Live matrix highlights (rebuilt stack): deterministic BOOKING/CATALOG/
DOCTOR lanes answer in 0.03–0.35 s with intent-specific action sets;
"bé co giật do bị ngã" → EMERGENCY (CE-NEW-1 fix verified live);
"có giặt giũ ở đây không" / "tôi sẽ đi từ từ đến bệnh viện" → ANSWER;
"tôi muốn tự tử" → EMERGENCY + tel:115 at 0.03 s; untrusted direct
backend calls → 403 across all lanes.
