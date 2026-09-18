# Project: HealthCare Platform Performance, Clinical Governance, Editorial Polish & Patient Safety Hardening

## Architecture
- **Backend Service (Spring Boot 3.5.4 / Java 21)**:
  - Repository Layer: `DoctorBranchRepository.java`, `DoctorSpecialtyRepository.java`, `DoctorRepository.java`.
  - Service Layer: `DoctorService.java` implementing batch pre-fetching via `toResponsePage(Page<Doctor>)` with `findByDoctorIdIn` and JPQL `JOIN FETCH` for associated `Branch` and `Specialty` entities.
  - Performance Profile: Replaces $1 + 2N$ query round-trips with exactly 2 batch queries for catalog pagination, reducing latency from $>25\text{s}$ timeout to $<200\text{ms}$ for 50 doctors.
- **Database & Flyway Migrations (PostgreSQL 16)**:
  - Migration `V82__reconcile_doctor_specialties_and_clean_data.sql`:
    - Reconciles 100% of all 506 doctors (6 canonical + 500 catalog) with their clinical bio specialties (`d.bio ILIKE '%trong lĩnh vực ' || s.name || '.%'`).
    - Purges 182 stock Unsplash `photo_url` values to `NULL` to enforce authentic initials portrait badges.
    - Updates 500 articles to authentic clinical pathology topics across 30 specialties, complementing the 4 pillar articles in V60 for 504 total authentic articles.
- **Frontend (Next.js 16.3.3 App Router & Tailwind/CSS)**:
  - Public Articles Catalog (`/articles`): `apps/frontend/app/articles/page.tsx` with inline `onError` fallback on all cards to `/media/articles/cham-soc-suc-khoe-tong-quat.jpg`.
  - Article Editorial Detail (`/articles/[slug]`): `apps/frontend/app/articles/[slug]/page.tsx` with hero image `onError` fallback, dynamic table of contents jump anchor, and high-contrast Emergency 115 Alert Card (`.article-news-alert-box--danger`) with clickable `tel:115` button (`.article-news-alert-box__call-115`).
  - Styling: `apps/frontend/app/styles.css` (lines 11046-11140 & 11548-11605) providing high-contrast red warning styling (`#e11d48`, `#fff1f2`, `#9f1239`) and accessible mobile touch target.
- **Testing & Quality Assurance**:
  - Backend Suite: 127 test files with Testcontainers PostgreSQL; Surefire invocation configured with `-DargLine=-Djdk.net.URLClassPath.disableClassPathURLCheck=true` for Windows JDK 24.
  - Frontend Suite: Node.js native test runner (`node --test`), 368 tests, TypeScript typecheck, ESLint code quality gate.
  - AI Service Suite: 730 pytest tests.
  - E2E Browser Testing: Playwright 1.62.1 test harness (`scripts/audit-r6-browser.mjs`, `scripts/challenge-m5-adversarial.mjs`, `scripts/probe-doctors-pagination.mjs`) verifying live doctor catalog loading, emergency 115 card, and capturing high-res screenshots.
- **Deployment Infrastructure**:
  - Vercel Production linked to `healthcare` project, mapped to `https://www.healthcare.id.vn` and `https://healthcare.id.vn`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---|---|---|---|
| F1 | Doctor Catalog N+1 Query Elimination | Batch pre-fetching via `findByDoctorIdIn` with `JOIN FETCH` in `DoctorBranchRepository` and `DoctorSpecialtyRepository`, orchestrated in `DoctorService.toResponsePage` | M1 | ORIGINAL_REQUEST R1 |
| F2 | Doctor Specialties Reconciliation | Align 100% (506/506) doctors with their clinical bio specialty via Flyway migration `V82` | M2 | ORIGINAL_REQUEST R2 |
| F3 | Doctor Portrait Data Hygiene | Reset 182 stock Unsplash `photo_url` values to `NULL` to display genuine Initials Avatar badges | M2 | ORIGINAL_REQUEST R2 |
| F4 | "Phần X" Title Elimination & 504 Authentic Topics | Overhaul 500 articles in V82 across 30 specialties (plus 4 anchor articles in V60 = 504 total), completely eliminating "(Phần X)" and "Phần " | M3 | ORIGINAL_REQUEST R3 |
| F5 | Emergency 115 Alert Box & Call Button | High-contrast `.article-news-alert-box--danger` and `.article-news-alert-box__call-115` with `tel:115` on acute medical articles | M4 | ORIGINAL_REQUEST R4 |
| F6 | Image onError Fallback Handlers | Defensive `onError` fallback on all `<img>` tags in `/articles` and `/articles/[slug]` switching to internal standard image | M4 | ORIGINAL_REQUEST R5 |
| F7 | Full Test Suites Verification | 100% PASS on Backend Spring Boot tests and Frontend 368 unit tests | M5 | ORIGINAL_REQUEST R6 |
| F8 | Playwright Browser Audit & Screenshots | Automated browser tests checking doctor catalog loading, emergency 115 card, and capturing verification screenshots | M5 | ORIGINAL_REQUEST R6 |
| F9 | Vercel Production Deployment & Live Verification | Production build deployment and live HTTP 200 verification on `https://www.healthcare.id.vn` | M5 | ORIGINAL_REQUEST R6 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Backend Performance: Doctor Catalog N+1 Elimination | Feature F1: Verify batch queries in `DoctorBranchRepository`, `DoctorSpecialtyRepository`, `DoctorService`, confirm query count and latency reduction | none | DONE |
| M2 | Clinical Governance & Data Hygiene | Features F2, F3: Verify Flyway `V82` migration, 506/506 doctors matched to bios, 182 Unsplash photos nulled | none | DONE |
| M3 | Editorial Polish: Article Titles & Topics Overhaul | Feature F4: Verify elimination of "(Phần X)", validate 504 authentic pathology topics across 30 clinical specialties | none | DONE |
| M4 | Clinical UX & Frontend Robustness | Features F5, F6: Verify Emergency 115 alert card CSS/layout and img `onError` fallbacks across article pages | none | DONE |
| M5 | Comprehensive Testing, Browser Audit & Deployment | Features F7, F8, F9: Run full test suites, execute dedicated Playwright E2E browser audit with screenshots, verify Vercel Production live deployment | M1, M2, M3, M4 | DONE |

## Interface Contracts
### `DoctorService` ↔ Database Repositories
- `DoctorBranchRepository.findByDoctorIdIn(Collection<UUID> doctorIds)`:
  - Query: `select db from DoctorBranch db join fetch db.branch where db.doctor.id in :doctorIds`
  - Returns: `List<DoctorBranch>` with initialized `Branch` entities in 1 SQL query.
- `DoctorSpecialtyRepository.findByDoctorIdIn(Collection<UUID> doctorIds)`:
  - Query: `select ds from DoctorSpecialty ds join fetch ds.specialty where ds.doctor.id in :doctorIds`
  - Returns: `List<DoctorSpecialty>` with initialized `Specialty` entities in 1 SQL query.
- Output Contract: `Page<DoctorResponse>` with 0 additional secondary database queries.

### Flyway Migration `V82` Contract
- Purges: `DELETE FROM doctor_specialties`
- Inserts: Explicit inserts for 6 canonical doctors (`nguyen-minh-khoi`, `vo-thi-mai`, `le-van-duc`, `pham-hoang-yen`, `tran-thu-ha`, `do-quang-huy`) + dynamic bio join for 500 catalog doctors.
- Sanitizes: `UPDATE doctors SET photo_url = NULL WHERE photo_url LIKE '%unsplash%'`.
- Overhauls: Exactly 500 `UPDATE articles SET title = ..., slug = ..., summary = ..., category = ... WHERE id = ...`.

### Frontend Article Components ↔ Assets
- Emergency Card Selector: `.article-news-alert-box.article-news-alert-box--danger` with CTA `a.article-news-alert-box__call-115[href="tel:115"]`.
- Image onError Contract:
  ```tsx
  onError={(e) => {
    const target = e.currentTarget;
    if (!target.src.endsWith("/media/articles/cham-soc-suc-khoe-tong-quat.jpg")) {
      target.src = "/media/articles/cham-soc-suc-khoe-tong-quat.jpg";
    }
  }}
  ```

## Code Layout
- `apps/backend/src/main/java/com/healthcare/hospital/repository/DoctorBranchRepository.java`
- `apps/backend/src/main/java/com/healthcare/hospital/repository/DoctorSpecialtyRepository.java`
- `apps/backend/src/main/java/com/healthcare/hospital/service/DoctorService.java`
- `apps/backend/src/main/resources/db/migration/V82__reconcile_doctor_specialties_and_clean_data.sql`
- `apps/frontend/app/styles.css`
- `apps/frontend/app/articles/page.tsx`
- `apps/frontend/app/articles/[slug]/page.tsx`
- `apps/frontend/public/media/articles/cham-soc-suc-khoe-tong-quat.jpg`
- `apps/frontend/tests/e2e/`
- `scripts/`
