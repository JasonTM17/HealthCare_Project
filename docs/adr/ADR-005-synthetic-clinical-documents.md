# ADR-005: Synthetic clinical documents (visit summary and prescription PDFs)

- Status: Accepted for the synthetic beta (D-03 owner decision, 2026-09-09)
- Date: 2026-09-09
- Closes part of: HC-05 (plans/260909-1834-healthcare-whole-system-audit-remediation)

## Context

Finding HC-05 recorded that patient "documents"/"medical-records"/"prescriptions"
routes were dashboard-anchor redirects, lookup used browser print, and no
server-generated, versioned, authorized document class existed. Owner decision
D-03 approves exactly two MVP document classes, both explicitly synthetic:

1. **VISIT_SUMMARY** — synthetic bản tổng kết lần khám rendered from a completed
   `medical_records` row.
2. **PRESCRIPTION** — synthetic đơn thuốc rendered from an `ACTIVE` prescription.

Legally signed records, diagnostics, and accounting receipts remain out of scope.

## Decision

### Library: Apache PDFBox 3.x (Apache-2.0)

PDFBox is chosen over OpenPDF (LGPL/MPL dual license) because:

- Apache-2.0 matches the repository's existing dependency posture (JWT, MinIO,
  Testcontainers are Apache-2.0); OpenPDF's LGPL option requires an explicit
  licensing posture this project has not adopted.
- PDFBox renders with explicit `PDType0Font` embedding and exposes the COS
  document-info dictionary, which is all this MVP needs; OpenPDF is a fork of
  iText 4 with the same capability but no licensing advantage.
- PDFBox has no network code paths; rendering is fully offline.

Dependency: `org.apache.pdfbox:pdfbox:3.0.5` (apps/backend/pom.xml only).

### Fonts and determinism

- `NotoSans-Regular.ttf` and `NotoSans-Bold.ttf` (SIL OFL 1.1) are bundled under
  `apps/backend/src/main/resources/fonts/` (provenance and SHA-256 in
  `fonts/README.md`, license in `fonts/OFL.txt`). Noto Sans covers Vietnamese
  Latin Extended Additional diacritics. Fonts are loaded from the classpath —
  the renderer never touches the network.
- Deterministic rendering contract: every byte in the PDF derives from the
  source-record snapshot plus fixed template constants. The document-info
  creation/modification dates are set from the source record's finalized
  timestamp (not `Instant.now()`); producer and template version are constants.
  Rendering the same snapshot twice must produce identical bytes; a service test
  pins this.
- Integrity model: the DB stores `sha256` of the **PDF bytes**. The PDF displays
  the SHA-256 of the canonical source-snapshot JSON (a PDF cannot contain its
  own byte hash). Both are integrity metadata, not a digital signature.

### State model

`PENDING` / `AVAILABLE` / `FAILED` / `SUPERSEDED` / `REVOKED` for MVP.
Generation is synchronous: row insert → object write → `AVAILABLE`. An object
write failure marks the row `FAILED` and surfaces 503. A newer successful export
for the same patient/source type/source record supersedes older available rows.
`REVOKED` and `SUPERSEDED` documents stay listed for audit/history but deny
download.

### Idempotency

`idempotency_key = source_type + source_record_id + source_version +
template_version`, where `source_version` is the source record's `updated_at`
epoch-milli (a re-edited record yields a new key and a new document). The key is
UNIQUE in the database; regeneration with the same key returns the existing row
and never writes a second object. A previously `FAILED` row is retried in place
so a transient object-store outage does not permanently brick that source
version/template.

### Storage and access

Objects go to the existing MinIO bucket under `documents/{patientId}/{uuid}.pdf`
through a `DocumentObjectStore` adapter over the shared `MinioClient` bean
(same conventions as `FileStorageService`: ensure bucket, put, get, no public
policies). Downloads stream through the BFF with `Cache-Control: no-store`,
`Content-Disposition: attachment`, and require AVAILABLE status plus the same
ownership rules as generation: owning patient, issuing doctor, or admin.

After an object upload succeeds, `patient_document_object_cleanup` records the
object key in a separate transaction with a short grace period. Successful DB
finalization resolves the marker after commit; if finalization rolls back or the
process crashes first, the scheduled cleanup worker later deletes only keys that
are no longer referenced by `patient_documents`. Immediate best-effort delete is
also attempted on the synchronous error path.

### API surface

`GET/POST /api/v1/patients/{patientId}/documents` and
`GET /api/v1/patients/{patientId}/documents/{documentId}/download`, covered by
the existing `anyRequest().authenticated()` rule plus service-level role checks
(pattern with `ClinicalService`). The generic BFF catch-all proxies these paths
with unchanged auth semantics.

## Non-goals

- No digital signatures, PKI, timestamps authorities, or QR verification.
- No legal validity: every PDF carries the visible line
  "BẢN TỔNG HỢP DEMO — KHÔNG PHẢI CHỨNG TỪ Y KHOA CÓ CHỮ KÝ" and UI copy never
  claims legal validity.
- No diagnostics or accounting/receipt classes (D-03).
- No async document-generation queue or retention policy in this MVP.

## Consequences

- Generation, listing, and downloads are strictly owner-scoped and audited via
  the existing clinical access audit service.
- Template or font changes change the template version constant, which changes
  the idempotency key and therefore produces a fresh document per source.
- If a hosted font download had failed, font-dependent steps would have been
  recorded BLOCKED_CAPABILITY; both fonts downloaded successfully.
