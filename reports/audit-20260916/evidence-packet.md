# Evidence Packet — 2026-09-16 deep multi-role audit (frozen for --ultra planning)

Repo: D:\HealthCare_Project @ main `ebaeea3` (origin/main in sync). Merge of
`fix/chat-grounding-reliability` already landed (`acaf011`) plus 4 follow-up commits.
Working tree: 1 coherent uncommitted feature (branch online-booking availability,
420 insertions / 21 files, FE+BE+tests). FE unit tests: 334/334 pass on this tree.
Audit sources: 4 subagent audits (public site, doctor portal, chatbot e2e, admin+SMTP),
1 subagent patient-API contract table, plus direct TinyMCE/media/storage audit.
Each finding below carries `path:line` evidence. Severity: P0 broken/unsafe,
P1 unprofessional or wrong business behavior, P2 polish.

## A. Public site (unauthenticated)

- A1 P0-sec `apps/frontend/app/auth/login/page.tsx:22,28,38,48,69-73,170-203` — login page
  advertises demo emails for all three roles and autofills password `HealthCare@2026`;
  seeded active users confirmed `V58__seed_healthcare_com_demo_users.sql:9-12`. Any
  visitor can enter the admin portal. Must be gated to non-production only.
- A2 P1 `V67__expand_branch_demo_doctor_catalog.sql:12-20` seeds fictional
  "DỮ LIỆU MINH HỌA" doctors; public list shows them with booking CTAs
  `apps/frontend/app/doctors/DoctorsPageClient.tsx:204-212`; homepage cards
  `apps/frontend/app/page.tsx:907-910`; detail page has NO demo disclosure
  `apps/frontend/app/doctors/[slug]/page.tsx:85-90` — fake clinicians bookable, detail
  page misrepresents them as real.
- A3 P1 `apps/frontend/components/PackageBookingModal.tsx:679-682` claims "Tất cả các
  cơ sở" have full testing/imaging equipment; schema has no per-branch capability
  (`V2__hospital_domain.sql:18-24`, `V15__expand_stitch_content_contracts.sql:3-7`).
  Unsafe medical-operations claim.
- A4 P1 `apps/frontend/components/BookingModal.tsx:1730-1733,1750-1752` — after a PUBLIC
  (unauthenticated) booking, success CTAs link to `/patient/dashboard…` (login wall).
  Payment instruction "Thanh toán chuyển khoản" leads to an authenticated page.
- A5 P1 `apps/frontend/app/benh-pho-bien/page.tsx:288-309` — public empty-state CTA
  "Hỏi bác sĩ chuyên khoa" links to `/patient/community` (private portal).
- A6 P2 `apps/frontend/app/page.tsx:1046-1052` homepage shows "đang được cập nhật"
  placeholder copy when the articles API is empty; `:1066-1075` nested duplicate links
  on article rows (a11y).
- A7 P2 `apps/frontend/app/layout.tsx:36-38` + `app/robots.ts:3-8` — indexing disabled
  unless `NEXT_PUBLIC_ALLOW_INDEXING === "true"`; production is invisible to search
  engines if env missing. `app/sitemap.ts:9-26,38-44` omits doctor/specialty/service/
  package/branch/article detail pages.

## B. Doctor portal (clinical)

- B1 P1 Lab workflow: doctor can only PUBLISH a diagnostic result; there is no order/
  request step. UI `apps/frontend/app/doctor/dashboard/page.tsx:563-571` →
  `lib/api-client.ts:3027-3034` → `DoctorPortalController.java:102-108` →
  `ClinicalService.java:352-359`. No order, specimen, status, performer, verification.
- B2 P1 `ClinicalService.java:327-333,460-474` — doctor authorized to add diagnostic
  results for ANY patient with ANY prior/active relationship (not today's encounter);
  UI also permits manual UUID lookup `doctor/dashboard/page.tsx:502-520`.
- B3 P1 Length mismatch: UI `maxLength=4000` `doctor/dashboard/page.tsx:475` vs DB
  `diagnosis VARCHAR(2000)` `V5__clinical_records_and_authorization.sql:21-29`; DTO has
  no `@Size` `CreateMedicalRecordRequest.java:23-24`; DataIntegrityViolation broadly
  mapped to duplicate-record 409 `ClinicalService.java:171-179` → wrong error message.
- B4 P1 Prescription safety minimal: single medication line UI
  `doctor/dashboard/page.tsx:482-493`; blind create `ClinicalService.java:143-165`;
  only nonblank checks `PrescriptionItemDto.java:5-26`; audit table supports only
  READ/DOWNLOAD, no PRESCRIBE action `V52__clinical_access_audit.sql:17-20`.
- B5 P2 Queue mislabeled: "LỊCH HẸN ĐÃ XÁC THỰC" `doctor/dashboard/page.tsx:435-440`
  but filter includes `PENDING_CONFIRMATION` `:34-43`; backend returns all statuses
  when unfiltered `AppointmentPortalService.java:94-100`.
- B6 P2 `doctor/dashboard/page.tsx:414-417` — `aiCredits ?? 150` invents "150 lượt AI
  khả dụng" when backend omits the field.
- B7 P2 Test date loses time-of-day: `lib/business-time.ts:47-49` posts midnight +07:00;
  `ClinicalService.java:358` persists as-is.
- Strengths: doctor scoping server-side for queue `AppointmentRepository.java:83-98`;
  record authorship checks `ClinicalService.java:99-116`; slot conflict protection via
  advisory lock + exclusion constraint `BookingService.java:231-273`,
  `V11__branch_aware_active_booking_constraints.sql:20-44`.

## C. Patient portal (contract table audited: 40 endpoints)

- C1 P1 `lib/api-client.ts:2970` sends `PATCH /notifications/{id}/read` but backend
  exposes `PUT` `NotificationController.java:23,40` — mark-one-read is broken (405).
- All other 39 endpoints VERIFIED (appointments, payment, records, prescriptions,
  documents, care plans, health questions, preferences, consultations, AI history).
- Strengths: BFF same-origin gate + CSRF contract tests pass; portal states component
  exists (`PortalStates.tsx`).

## D. Admin portal + SMTP

- D1 P1 Missing delete audit: doctor/service/branch/package deletes are direct repo
  deletes with no revision snapshot `AdminDoctorService.java:67-71`,
  `AdminServiceService.java:54-57`, `AdminBranchService.java:56-59`,
  `AdminPackageService.java:65-69` (article/specialty/FAQ DO snapshot:
  `AdminArticleService.java:103-108`).
- D2 P1 Unpaginated admin queues: health questions `AdminHealthQuestionController.java:20-21`,
  consultations `AdminConsultationController.java:21-22`; AI credits backend pages but
  FE sends no params `AdminAiCreditController.java:53-70` + `api-client.ts:3186-3191`.
- D3 P2 Form gaps: doctor form omits `userId` (`DoctorRequest.java:7-14` accepts it;
  `admin/doctors/page.tsx:38-45` never sends); specialty form sends only
  name/slug/description/active while DTO accepts rich clinical fields
  (`SpecialtyRequest.java:8-23` vs `admin/specialties/page.tsx:25-26`).
- D4 P1 SMTP outage hard-fails auth: with outbox disabled, OTP/verification/password
  reset email = 503 `SmtpEmailSender.java:30-38,62-69`; registration calls issue inside
  the transaction `AuthOtpService.java:146-160` + `AuthService.java:156-164`. Degrade
  path exists only via `AfterCommitEmailSender.java:144-174` best-effort; payment status
  uses normal send `PaymentStatusEmailService.java:49-59`.
- Strengths: role gating aligned `SecurityConfig.java:109-126`; dashboard stats are
  real totals `admin/page.tsx:90-114`; email templates are code-rendered with 11 keys
  `EmailTemplateKey.java:5-79`; durable outbox worker with retry exists.

## E. Chatbot end-to-end

- E1 P2 Contract drift: AI emits `used_sources`, `cost_tier`, `routing_reason`
  (`apps/ai-service/app/schemas.py:219-234`) but Java drops them
  (`AiConversationService.java:975-1021`, DTO `ChatContracts.java:100-115`) and TS
  omits (`types/hospital.ts:744-760`) — cost observability can't reach ops/UI.
- E2 P2 Prod config: patient remote-LLM egress disabled (`config.py:36-50,129-146`;
  `render.yaml:63-68` sets patient remote false) → complex multi-symptom patient chats
  stay local/fail-closed, never escalate (deliberate cost gate; needs explicit product
  decision + docs, or enable).
- E3 P2 `FloatingHealthAssistant.tsx:653-661` dialog lacks focus trap + `aria-modal`;
  unused trap helper exists `AssistantProvider.tsx:392-400`.
- E4 OPEN Abort propagation stops at BFF; Spring/FastAPI generation is synchronous —
  closing the widget leaves server work running
  (`healthcare-bff.ts:745-770`, `AiConversationService.java:398-460`, `main.py:759-789`).
- Strengths: grounding fail-closed with Spring-authorized sources
  (`AiConversationService.java:488-571,948-1021`); public citations verified against
  live catalog (`PublicAiChatController.java:130-174,481-547`); emergency 115 +
  prescription refusal at both layers; retryable error UI; conversation persistence
  with guest "Không lưu lịch sử" honesty.

## F. TinyMCE / rich content / media pipeline (direct audit)

- F1 P0-feature `render.yaml:195-205` sets `STORAGE_UPLOAD_ENABLED="false"` on the
  hosted backend while the editor requires `POST /api/v1/media/upload`
  (`RichTextEditor.tsx:615-622` via `api-client.ts:3269-3277`;
  `MediaAssetController.java:38-39` PATIENT/DOCTOR/ADMIN). In production the toolbar
  image button, quickimage, paste-image, and the ImageUpload cover component all fail
  → the editor ships broken in prod.
- F2 P1 WYSIWYG dishonesty: editor emits HTML, `RichTextEditor.tsx:273-276` converts to
  markdown via `htmlToMarkdown` before save; the converter
  (`RichContentRenderer.tsx:927-1120`) drops forecolor/backcolor/fontfamily/fontsize/
  superscript/subscript (toolbar offers them at `RichTextEditor.tsx:360`), so published
  articles silently lose those styles. Public render path is HTML→MD→React blocks
  (`RichContentRenderer.tsx:1226-1247`) — no dangerouslySetInnerHTML on bodies (only
  JSON-LD uses it, `app/layout.tsx:63`, `JsonLd.tsx:28`, `benh-pho-bien/[slug]:186`).
- F3 P2 `htmlToMarkdown.tsx:927` comment claims iframe stripping but only script/style
  regexes exist; harmless today (stripTags + React rendering) but the comment lies.
- F4 OK: all 24 configured plugins exist in `public/tinymce/plugins/` (self-hosted
  tinymce 8.9, licenseKey gpl, skins oxide + content default present); custom clinical
  buttons registered `RichTextEditor.tsx:486-610`; `articles.body VARCHAR(8000)` =
  DTO `@Size(max=8000)` `V2__hospital_domain.sql:53` + `ArticleRequest.java:17`; seeded
  bodies ≤ ~3200 chars.

## G. Uncommitted tree state (must be resolved by the plan)

- G1 `git diff` = coherent branch-booking-availability feature (420 insertions, 21
  files): `Branch.activeDoctorCount` through DTO/repo/service
  (`BranchResponse.java`, `DoctorBranchRepository.java`, `BranchService.java`),
  FE gating of booking CTAs per branch (`branches/page.tsx`, `branches/[slug]/page.tsx`,
  `dat-lich/page.tsx`, `DoctorsPageClient.tsx`, `PublicPageShell.tsx`, `app/page.tsx`),
  tests updated. Complements A2 (fake doctors bookable).
- G2 Untracked: `apps/frontend/pnpm-lock.yaml` (stray — project uses npm), `reports/`.

## Constraints

- Deploy: Vercel auto-deploys main (domain www.healthcare.id.vn). Render backend
  free-tier deploy blocker was owner-side; trigger via Render API `RENDER2_API_KEY`
  (working) or owner Manual Deploy; Flyway V75 (widen audit target CHECK to include
  'DOCUMENT') runs on next successful deploy.
- Gates: FE `node --test tests/*.test.mjs` (334), typecheck, Playwright e2e
  (chromium + a11y), backend `mvn test` targeted, ai-service pytest.
- Language: all user-facing copy Vietnamese; medical safety disclaimers required.
