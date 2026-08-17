# Smart Hospital AI Platform - Project Plan

## Current Repository State

Status: `PHASE 0 - Repository Discovery` complete enough to plan. Application implementation has not started in this working tree.

Evidence inspected on 2026-08-17:

- Project instructions exist: `AGENTS.md`, `OPENCODE.md`.
- AgentKit plan templates exist under `plans/templates/`.
- One completed historical AgentKit adapter plan exists: `plans/20260815-1600-gemini-harness/`.
- No application `README.md` exists.
- No `.git` directory exists in `D:\HealthCare_Project`; Git commands fail with `fatal: not a git repository`.
- No application folders exist yet: `apps/backend`, `apps/frontend`, `apps/ai-service`, `infrastructure`, and application `docs/architecture` are absent.
- No backend metadata exists: no `pom.xml`, Maven wrapper, Java source, tests, Flyway migrations, or Spring configuration found.
- No frontend metadata exists: no root/app `package.json`, Next.js config, TypeScript config, tests, or Tailwind config found.
- No AI service metadata exists: no `pyproject.toml`, `requirements.txt`, FastAPI source, or pytest tests found.
- No Docker Compose or application Dockerfiles found.
- `.opencode/node_modules/` exists and should not be treated as application code; ensure it is ignored before committing.
- The GitHub URL `https://github.com/JasonTM17/HealthCare_Project` was probed read-only with `git ls-remote`; no refs were returned in this environment. This must be rechecked before connecting a remote.

Current implementation phase: before Phase 1. The correct next engineering step is repository foundation, not feature coding.

## Architecture

Target architecture is a pragmatic monorepo with a modular monolith backend and a separate AI service only where it provides clear separation of concerns.

```text
apps/frontend  -> Next.js TypeScript web application
apps/backend   -> Spring Boot 3 Java 21 modular monolith
apps/ai-service -> FastAPI AI/RAG service

backend -> PostgreSQL + pgvector
backend -> Redis
backend -> MinIO-compatible object storage
backend -> ai-service over internal REST
frontend -> backend over /api/v1 REST
```

Backend module boundaries:

- `auth`, `user`, `security`, `audit`, `notification`
- `branch`, `specialty`, `doctor`, `service`, `medicalpackage`, `article`, `faq`
- `schedule`, `appointment`
- `patient`, `clinical`, `prescription`, `diagnostic`, `storage`
- `ai` as backend integration boundary to the AI service
- `common` only for cross-cutting primitives such as error responses, pagination, request IDs, and time utilities

Frontend feature boundaries:

- Public website: home, doctors, specialties, branches, services, packages, articles, FAQ/contact
- Auth
- Patient portal
- Doctor portal
- Admin CMS
- AI assistant and AI-powered search/recommendations
- Shared components and API client in stable `src/components`, `src/lib`, `src/types`

AI service boundaries:

- Provider abstraction: chat completion and embeddings
- RAG document ingestion and retrieval
- Specialty recommendation with safe healthcare guardrails
- Doctor recommendation through structured intent extraction, with backend verification of doctors/schedules
- Semantic search over active/published hospital knowledge

## Implementation Phases

### Phase 0 - Repository Discovery

Status: `DONE` for initial local assessment.

Deliverables:

- Inspect instructions, docs, structure, dependency metadata, migrations, tests, Docker, and Git state.
- Create this `docs/PROJECT_PLAN.md`.
- Do not implement application features.

Validation:

- `git rev-parse --show-toplevel` - `FAIL`, not a Git repository.
- `git status --short --branch` - `FAIL`, not a Git repository.
- File discovery - `PASS`, no app skeleton found.

### Phase 1 - Project Foundation

Goal: establish a clean, version-controlled monorepo skeleton without premature business features.

Required steps:

1. Decide whether to initialize Git locally or clone/connect the GitHub repository into a clean directory.
2. Add root `.gitignore` excluding `node_modules/`, build outputs, logs, env files, IDE files, local DB/files, coverage, caches, and `.opencode/node_modules/`.
3. Add root `README.md`, `CONTRIBUTING.md`, `.env.example`, and docs folders.
4. Bootstrap `apps/backend` with Spring Boot 3, Java 21, Maven wrapper, basic health endpoint, profile-based config, and no business entities yet.
5. Bootstrap `apps/frontend` with Next.js, TypeScript, Tailwind CSS, lint/typecheck/test/build scripts, and a minimal accessible shell.
6. Bootstrap `apps/ai-service` with FastAPI, Pydantic, pytest, lint/format/typecheck tooling, and a health endpoint.
7. Add `docker-compose.yml` for PostgreSQL, Redis, MinIO, backend, frontend, and AI service as soon as each service has a runnable baseline.
8. Add baseline CI after local commands are known to pass.

Suggested commits:

- `chore(repo): initialize project structure`
- `feat(backend): bootstrap Spring Boot application`
- `feat(frontend): bootstrap Next.js application`
- `feat(ai): bootstrap FastAPI service`
- `chore(docker): add local development infrastructure`
- `docs: add project setup instructions`

Acceptance criteria:

- Git repository is initialized or correctly connected to remote.
- Root `.gitignore` prevents generated junk from being tracked.
- Each service has a health check and documented local command.
- Root README explains setup, run, test, Docker, demo scope, and environment variables.
- No secrets committed.

### Phase 2 - Database Foundation

Goal: establish safe database lifecycle and identity/RBAC persistence.

Required backend work:

- PostgreSQL configuration via environment variables.
- Flyway enabled with incremental migrations.
- `ddl-auto=validate` after migrations exist.
- UUID identifier strategy documented in ADR.
- Base timestamp handling with UTC timestamps for audit fields and `Asia/Ho_Chi_Minh` for user-facing scheduling rules.
- Tables: `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, refresh token/session table if selected.
- Seed roles: `PATIENT`, `DOCTOR`, `ADMIN`, optionally `STAFF`, `SUPER_ADMIN` only when used.

Required docs:

- `docs/adr/ADR-001-modular-monolith.md`
- `docs/adr/ADR-002-authentication-strategy.md`
- `docs/database/schema-overview.md`

Suggested commits:

- `feat(db): add Flyway migration framework`
- `feat(auth): add user and role persistence model`
- `test(auth): add repository integration tests`

### Phase 3 - Authentication and Security

Goal: secure auth before protected product features.

Required work:

- Registration, login, logout, current user, refresh token rotation, password hashing with BCrypt.
- Decide cookie vs bearer token strategy and document CSRF/XSS implications.
- Centralized error format for `/api/v1`.
- Validation with Jakarta Validation.
- Role-based authorization enforced server-side.
- Rate limiting strategy for login/register/forgot password.
- Frontend auth forms and session-aware navigation only after backend contract exists.

Required tests:

- Register/login success and validation failures.
- Duplicate email conflict.
- Password hash never exposed.
- Role-protected endpoint denies unauthorized users.
- Refresh token rotation/reuse behavior.

Suggested commits:

- `feat(auth): implement user registration`
- `feat(auth): implement secure login`
- `feat(auth): add refresh token rotation`
- `feat(security): add role-based authorization`
- `test(auth): add authentication integration tests`

### Phase 4 - Public Hospital Domain

Goal: create real hospital content APIs and public pages.

Backend entities:

- Branches, specialties, doctors, doctor-specialty, doctor-branch, medical services, medical packages, articles, article categories, FAQ.

Frontend routes:

- `/`, `/about`, `/doctors`, `/doctors/[slug]`, `/specialties`, `/specialties/[slug]`, `/services`, `/services/[slug]`, `/packages`, `/packages/[slug]`, `/branches`, `/branches/[slug]`, `/articles`, `/articles/[slug]`, `/faq`, `/contact`.

Rules:

- Use fictional content and original branding.
- Do not copy assets/layout/brand from hospital websites.
- Public lists must be paginated and filterable where useful.
- Only active/published content is public.

Suggested commits:

- `feat(specialty): add specialty catalog API`
- `feat(doctor): add doctor directory API`
- `feat(branch): add hospital branch API`
- `feat(content): add service and package APIs`
- `feat(article): add article publishing domain`
- `feat(frontend): build hospital homepage`
- `feat(frontend): add public catalog pages`

### Phase 5 - Admin CMS

Goal: allow admins to manage public hospital content securely.

Required work:

- Admin CRUD APIs for doctors, specialties, branches, services, packages, articles, FAQ.
- Input validation and uniqueness constraints for slugs.
- Rich content sanitization plan for articles.
- Admin UI with tables, forms, empty/loading/error states.

Required tests:

- Admin success paths.
- Patient/doctor/public forbidden paths.
- Validation and slug conflict cases.

### Phase 6 - Doctor Scheduling

Goal: implement recurring schedules and availability calculation.

Data model:

- `doctor_schedules`: doctor, branch, day of week, start/end time, slot duration, effective range, active.
- `doctor_schedule_exceptions`: doctor, branch/date, type, custom hours or blocked/leave reason.

Rules:

- Reject invalid time ranges.
- Reject overlapping schedules unless explicitly designed.
- Generate available slots dynamically from schedules, exceptions, and appointments.
- Do not pre-generate large slot tables without a documented reason.

Required ADR:

- `docs/adr/ADR-003-appointment-concurrency.md` should include slot generation and uniqueness strategy.

### Phase 7 - Appointment System

Goal: implement booking, cancellation, rescheduling, and state transitions with database-enforced integrity.

Core rules:

- Statuses: `PENDING`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.
- Transitions must be validated in the service/domain layer.
- Duplicate booking must be prevented by database constraint, not only frontend checks.
- Booking and rescheduling must be transactional.
- Conflict response must be HTTP `409` with user-friendly error.

Required tests:

- Available slot calculation with existing appointments.
- Duplicate concurrent booking: exactly one succeeds.
- Invalid transitions rejected.
- Patient can only access own appointment unless role permits.
- Reschedule rollback preserves original appointment on failure.

### Phase 8 - Patient Portal

Goal: patients can manage their own health journey safely.

Routes:

- `/patient/dashboard`, `/patient/profile`, `/patient/appointments`, `/patient/appointments/[id]`, `/patient/medical-records`, `/patient/prescriptions`, `/patient/diagnostic-results`, `/patient/documents`, `/patient/notifications`.

Rules:

- Object-level authorization is mandatory.
- Avoid collecting unnecessary sensitive fields.
- Frontend must handle unauthorized/forbidden/empty states.

### Phase 9 - Doctor Portal and Clinical Workflow

Goal: doctors can see assigned appointments and create permitted clinical records.

Required work:

- Doctor dashboard and daily appointment view.
- Appointment detail with permitted patient summary.
- Medical records, consultation notes, prescriptions, and completion workflow.
- Doctors can create/update only permitted clinical data.
- Patients can read their own permitted records.

Rules:

- Admins should not casually edit prescriptions.
- Do not claim legal EHR compliance; document educational scope.

### Phase 10 - Files and Diagnostic Results

Goal: add secure object storage for medical documents and media.

Required work:

- MinIO integration.
- Secure object key generation.
- MIME/extension/size validation.
- Private access for medical documents.
- Diagnostic result metadata referencing stored objects.

Required tests:

- Reject invalid uploads.
- Enforce authorization on private files.
- Avoid trusting uploaded filenames.

### Phase 11 - Notifications

Goal: add in-app notifications for important user events.

Events:

- Appointment created, confirmed, rescheduled, cancelled, reminders, diagnostic result available.

Rules:

- Persist concise notification content.
- Support read/unread state.
- Email is optional and should not block core flows.

### Phase 12 - AI Foundation

Goal: create safe provider abstraction before RAG/recommendations.

AI service requirements:

- `LLMClient`, `EmbeddingClient`, `Retriever`, `RagService` interfaces.
- Provider configured through environment variables only.
- Request timeouts, input size limits, graceful failure messages.
- Observability without logging sensitive patient text indiscriminately.

Environment variables:

```env
AI_PROVIDER=
AI_API_KEY=
AI_CHAT_MODEL=
AI_EMBEDDING_MODEL=
AI_MAX_INPUT_CHARS=
AI_MAX_RETRIEVED_CHUNKS=
```

Suggested commits:

- `feat(ai): add LLM provider abstraction`
- `feat(ai): add embedding provider abstraction`
- `test(ai): add provider contract tests`

### Phase 13 - RAG

Goal: implement grounded hospital assistant over trusted application data.

Data model:

- `ai_documents`: source type, source ID, title, normalized content, metadata, content hash, embedding, timestamps.

Rules:

- Index only active/published content.
- Do not blindly index raw HTML.
- Use content hash to avoid duplicate embeddings.
- Responses include citations/references generated from stored entities, not invented URLs.
- AI must not diagnose or prescribe.

Required tests:

- Idempotent ingestion.
- Retrieval returns relevant active/published docs.
- Archived/inactive docs excluded.
- Provider failure degrades gracefully.

### Phase 14 - AI Recommendations

Goal: safely recommend specialties and doctors using verified application data.

Rules:

- Specialty recommendation must use cautious language and disclaimers.
- LLM output must be structured and validated.
- Never trust model-generated database IDs.
- Doctor recommendations must use backend data: specialties, branches, schedules, existing appointments.
- No fabricated doctors or availability.

### Phase 15 - Semantic Search

Goal: support hybrid keyword/vector search for public hospital knowledge.

Scope:

- Specialties, doctors, services, packages, articles, FAQ.

Rules:

- Use relational filters where they are better than embeddings.
- Bound result size and context size.
- Search only active/published resources.

### Phase 16 - AI Frontend

Goal: integrate AI assistant into the product without presenting it as a physician.

Required UX:

- Chat states: idle, loading, answer, citations, suggested actions, error.
- Specialty and doctor recommendation cards.
- Booking CTA connected to real appointment flow.
- Safety disclaimer that is visible but not disruptive.
- Graceful unavailable state when AI service fails.

Optional design support:

- Use Stitch MCP only for UI ideation/mockups if available and requested during design planning.
- Do not depend on Stitch output as production code without review and integration into the existing design system.

### Phase 17 - Security Hardening

Goal: explicitly review and harden security boundaries.

Audit areas:

- Auth, refresh tokens, cookies/CSRF/CORS, password reset, object-level authorization, admin APIs, medical records, uploads, AI rate limits, logging, error handling.

Required gates:

- Security-focused code review.
- Negative authorization tests.
- Secret scan before commits and before any push.

### Phase 18 - Performance

Goal: remove obvious bottlenecks based on evidence.

Review:

- N+1 queries, missing indexes, unbounded lists, frontend waterfalls, excessive rerenders, AI latency and context size.

Rules:

- Measure or inspect query patterns before adding indexes/caches.
- Define cache invalidation before using Redis for mutable content.

### Phase 19 - UX Polish

Goal: make the demo coherent, responsive, and accessible.

Focus:

- Navbar, homepage, doctor listing/detail, appointment booking, patient dashboard, doctor portal, admin tables, AI chat.

Rules:

- Avoid dead primary CTAs in the final demo.
- Use semantic HTML, labels, focus states, contrast, keyboard navigation, and mobile layouts.

### Phase 20 - CI/CD

Goal: add automated verification for all services.

Minimum checks:

- Backend: compile and tests.
- Frontend: install, lint, typecheck, test, build.
- AI service: lint/format/typecheck if configured, pytest.
- Docker build checks when stable.

### Phase 21 - Final End-to-End Demo

Goal: prove the primary story works end-to-end.

Demo flow:

1. Public user opens homepage.
2. User explores specialties and doctors.
3. User asks AI in Vietnamese about headache/dizziness.
4. AI safely suggests a real specialty.
5. User sees real doctors and real availability.
6. User books an appointment.
7. Patient portal shows appointment.
8. Doctor portal shows appointment.
9. Doctor records consultation and optional prescription.
10. Patient sees permitted medical information.
11. Notification appears.
12. Admin sees appropriate operational data.

## Completed Components

- AgentKit/OpenCode project instructions exist.
- Historical Gemini harness plan is completed but unrelated to the hospital application.
- Initial project plan exists in `docs/PROJECT_PLAN.md`.

## Missing Components

- Git repository initialization or verified remote clone/connection.
- Application README and contributor guide.
- Root `.gitignore`.
- Backend application.
- Frontend application.
- AI service.
- Docker Compose and Dockerfiles.
- Database migrations and seed data.
- CI pipeline.
- Tests.
- ADRs and architecture/database/API docs.

## Technical Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Current folder is not a Git repo | Cannot inspect history, branch, remote, or commit safely | Initialize Git or clone verified remote before Phase 1 implementation |
| `.opencode/node_modules/` exists | Accidental huge/generated commit | Add `.gitignore` before first commit; inspect status before staging |
| Scope is large | Many unfinished features | Deliver vertical slices phase-by-phase; prioritize primary demo story |
| Appointment concurrency | Data integrity failure | Use transaction plus database unique constraint and integration test |
| Healthcare AI safety | Unsafe advice/fabrication | Strict guardrails, RAG citations, backend data verification, disclaimers |
| Object-level authorization | IDOR exposure | Service-level ownership checks and negative tests |
| File uploads | Malware/private data exposure | Validate MIME/extension/size, private object keys, authorization checks |
| AI provider outage/cost | Broken UX or unexpected cost | Timeouts, rate limits, bounded input/retrieval, graceful fallback |
| Database migrations | Broken schema evolution | Flyway only, no casual edits to applied migrations |
| Frontend/backend contract drift | Broken flows | Central API types/client and contract-aware changes |

## Dependency Graph

```text
Phase 1 foundation
  -> Phase 2 database foundation
    -> Phase 3 auth/security
      -> Phase 4 public hospital domain
        -> Phase 5 admin CMS
        -> Phase 6 scheduling
          -> Phase 7 appointments
            -> Phase 8 patient portal
            -> Phase 9 doctor portal/clinical
              -> Phase 10 files/diagnostics
              -> Phase 11 notifications
      -> Phase 12 AI foundation
        -> Phase 13 RAG
          -> Phase 14 AI recommendations
          -> Phase 15 semantic search
            -> Phase 16 AI frontend
Phase 17 security hardening depends on all protected modules
Phase 18 performance depends on implemented flows
Phase 19 UX polish depends on frontend flows
Phase 20 CI/CD should begin in Phase 1 and mature throughout
Phase 21 final E2E depends on primary demo path completion
```

## Database Plan

Migration strategy:

- Use Flyway from the first database phase.
- Name migrations incrementally: `V001__create_auth_tables.sql`, `V002__create_hospital_content_tables.sql`, etc.
- Do not edit migrations after they are applied in shared environments; add new migrations.
- Keep schema and dependent code in a working repository state.

Initial migration sequence:

1. Auth and RBAC tables.
2. Hospital content tables: branches, specialties, doctors, services, packages, articles, FAQ.
3. Scheduling tables.
4. Appointment tables with uniqueness constraints.
5. Patient/clinical/prescription/diagnostic metadata tables.
6. Notification and audit tables.
7. Storage metadata tables if needed.
8. pgvector extension and AI document tables.

Core constraints:

- Unique email on users.
- Unique slugs for public resources.
- Foreign keys for ownership and relationships.
- Appointment uniqueness on doctor/date/start time, expanded with branch/room if the final model requires it.
- Check constraints for valid statuses, prices, time ranges, and slot durations where practical.

Index plan:

- `users.email`
- public slugs
- doctor-specialty and doctor-branch join tables
- appointments by patient, doctor, date, status
- article status and published date
- AI vector index after pgvector is introduced and retrieval patterns are clear

## Testing Plan

Backend:

- Unit tests for domain rules: appointment transitions, schedule calculation, cancellation, permissions, recommendation mapping.
- Integration tests for repositories, constraints, auth flows, booking conflict, Flyway migrations.
- Testcontainers for PostgreSQL where practical.

Frontend:

- Component tests for login, doctor filters, appointment form, patient dashboard, AI assistant states.
- Accessibility checks for key interactions.
- E2E tests for primary demo flow when backend and seed data are stable.

AI service:

- Provider contract tests with fake provider.
- Retrieval and ingestion tests.
- Structured-output validation tests.
- Safety tests for no diagnosis/prescription and graceful provider failure.

Verification commands to establish during Phase 1:

```bash
./mvnw test
npm run lint
npm run typecheck
npm run test
npm run build
pytest
docker compose up -d
```

Actual commands may differ after project bootstrap; documentation must be updated to match reality.

## Git Strategy

Current blocker: this folder is not a Git repository.

Before implementation:

1. Decide whether to initialize this folder with `git init` or clone the GitHub repository into a clean directory and move/copy only intentional project assets.
2. If connecting to GitHub, verify remote refs and auth with non-destructive commands.
3. Add `.gitignore` before staging anything.
4. Inspect `git status`, `git diff`, and recent log before every commit.
5. Use Conventional Commits and small logical units.
6. Do not push until explicitly authorized.

Suggested branch model:

- `main` for stable project state.
- `develop` only if the team wants integration staging.
- `feature/*`, `fix/*`, `docs/*`, `chore/*` for focused work.

Commit discipline:

- Each commit must represent one coherent change.
- Run relevant checks before every commit.
- Never commit secrets, generated junk, failing builds, temporary debug code, or unrelated changes.
- After each commit, inspect `git status` and `git log -1`.

## Immediate Next Steps

1. Resolve Git state: initialize repository or clone/connect the GitHub remote safely.
2. Add root `.gitignore`, `README.md`, `CONTRIBUTING.md`, `.env.example`, and base docs folders.
3. Bootstrap backend, frontend, and AI service in separate logical commits.
4. Add Docker Compose infrastructure once service skeletons exist.
5. Start Phase 2 only after Phase 1 checks pass.

## Open Questions

- Should this existing folder become the Git repository, or should the GitHub repository be cloned into a clean folder and this AgentKit adapter content reconciled afterward?
- Does the team require `develop`, or should the project use trunk-based development with short-lived feature branches?
- Should frontend auth use HTTP-only cookie tokens from the start, or bearer tokens for simpler university demo operations? Recommendation: HTTP-only cookie if time permits, bearer only if explicitly accepted and documented.
- Should AI service use a real provider during demo, or support a documented fake/local provider for offline grading? Recommendation: provider abstraction with fake provider for tests and optional real provider via env.
