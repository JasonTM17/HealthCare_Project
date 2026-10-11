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

### Lost-file recovery amendment (2026-10-11)

`POST /api/v1/patients/{patientId}/documents/{documentId}/regenerate` accepts
no request body and creates a **new export from current retained source data**.
The owning patient, source's issuing/assigned doctor, or administrator uses the
existing authenticated boundary. It supports generated documents only; missing
manually uploaded clinical originals cannot be reconstructed by this endpoint.

The original row, key, status, size, checksum and issuance history stay intact.
The explicit operation bypasses ordinary generation's FAILED-row adoption and
automatic supersession. The new row persists `regeneratedFromDocumentId`,
`sourceSnapshotSha256` and `recoveryReason=LOST_FILE_COPY` (V122). Its normal
actor/time, source/template version and actual PDF byte metadata complete the
lineage. Current template disclaimers remain visible: a new copy is neither a
restored original nor a signed or independently approved clinical record.

Recovery idempotency is `RECOVERY:{originalId}:{canonicalSnapshotSha256}`;
the hash includes source type/id/version, template and joined snapshot content.
Prescription items use stable ID order for recovery only. A retry resolves the
same successful replacement; failed retries use that separate replacement
attempt, never the original. Revoked, superseded, pending or ineligible originals
and sources are rejected. Ordinary generation retains its existing contract.

The source advisory lock is shared with ordinary generation. PostgreSQL row
locks cover the original, source, patient, doctor, relevant appointment/branch/
specialty or prescription items, and current actor/user-role/role rows until
publication commits. Locking the prescription parent also blocks foreign-key
inserts into its item collection. A fresh persistence-context read after locks
validates active, verified, unchanged session role/security version and source
ownership/eligibility before rendering. Contention is bounded by a 5-second
lock timeout and returns retryable conflict; facts and account settings are not
edited by recovery. Existing cleanup and after-commit allowed-audit handling are
reused. Generation authority is checked at publication; later authorized edits
are separate operations.

Known invalid size/hash metadata, byte mismatches and confirmed object-not-found
responses return JSON HTTP 503 with `DOCUMENT_CONTENT_UNAVAILABLE`. Temporary
provider failures return `SERVICE_UNAVAILABLE`; a 503 alone does not establish
lost content or authorize reconstruction. REST adapter treats actual HTTP 404
from an object GET as missing, and MinIO treats `NoSuchKey` as missing. Unknown
provider errors remain temporary failures. Clients can display a friendly
recovery action for the dedicated content code while keeping outage retries
separate. Actual original-byte restoration remains a separately verified
storage operation and must match the historical checksum and size.

- No digital signatures, PKI, timestamps authorities, or QR verification.
- No legal validity: every PDF carries the visible line
  "BẢN TỔNG HỢP DEMO — KHÔNG PHẢI CHỨNG TỪ Y KHOA CÓ CHỮ KÝ" and UI copy never
  claims legal validity.
- No diagnostics or accounting/receipt classes (D-03).
- No async document-generation queue or retention policy in this MVP.

## Consequences

- Download verifies the complete object against the stored byte length and
  SHA-256 before returning PDF bytes or recording an allowed download. Missing,
  invalid or mismatched integrity metadata fails with a safe JSON 503; original
  metadata and objects stay unchanged. Buffering is capped at 10 MiB, matching
  the private bucket limit. The upstream connection closes before handoff and
  ownership/status is rechecked after reading. Matching keys or a PDF header
  alone does not establish successful storage recovery.
- Appointment reminders also refresh their appointment and referenced patient,
  doctor, branch and specialty display fields before checking source freshness
  at handoff. A changed or cancelled source returns the existing JSON 409 and
  requires an authorized new export; the old document is never rewritten.

- PDF successes retain `application/pdf`. Typed business, missing-document and
  access errors return the JSON error envelope even when the request accepts
  only PDF; an incompatible `Accept` header returns 406 rather than 500.
  Download callers must inspect status/content type before saving a file.
- Generation, listing, and downloads are strictly owner-scoped and audited via
  the existing clinical access audit service.
- Template or font changes change the template version constant, which changes
  the idempotency key and therefore produces a fresh document per source.
- Template 1.1 increases line and section spacing, including adjacent empty
  sections. Previously generated files remain immutable; regenerate through
  the existing authorized workflow to obtain the current template.
- If a hosted font download had failed, font-dependent steps would have been
  recorded BLOCKED_CAPABILITY; both fonts downloaded successfully.
