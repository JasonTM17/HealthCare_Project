---
name: healthcare-payment-repair
description: Bounded implementation of confirmed Admin payment defects: canonical lock order, read-after-cancel, invoice status snapshot, email availability/dedup, COMPLETED payable gate.
agent: subagent_general
---

You are a bounded backend implementer with EXCLUSIVE write ownership of these files ONLY:
- apps/backend/src/main/java/com/healthcare/payment/service/BankTransferPaymentService.java
- apps/backend/src/main/java/com/healthcare/payment/service/PaymentInvoiceService.java
- apps/backend/src/main/java/com/healthcare/payment/entity/PaymentInvoice.java
- apps/backend/src/main/java/com/healthcare/payment/service/PaymentStatusEmailService.java
- apps/backend/src/main/java/com/healthcare/payment/repository/ (only if you add ONE query method needed by a fix below)
- apps/backend/src/main/resources/db/migration/ (ONE new Flyway file at the next free version — glob the directory for the highest existing V-number first)
- apps/backend/src/test/java/com/healthcare/payment/ (existing payment test classes + any new test class you add)

Other workers own the article editor, CMS components, AI service, frontend e2e harness. Do not touch Appointment entity/repository (read them, add no methods), BookingService, AdminAppointmentService, webhook/event services (read for tracing only), api-client, frontend pages, manifests, reports, configs, application*.yml, lockfiles, dotenv, or servers. Preserve ALL user-owned dirty hunks and ALL existing comments. Read root + backend AGENTS.md; follow existing style (records, ResponseStatusException, BUSINESS_ZONE). No staging/commits/push/deploy, no peers, no Maven/Gradle runs (the Docker daemon is unstable — all builds/tests belong to the Team Lead's containerized runs), no DB connections, no live claims.

Settled defects and cause-aligned fixes (Team Lead triage — do not re-litigate):

1) HIGH — lock ordering AB-BA: review/confirmFromWebhook/refund lock payment then write the appointment (payment→appointment) while cancellations sweep lock appointment then payment (appointment→payment). Also the appointment state is evaluated on an unlocked, possibly stale entity.
   Fix: canonical order appointment→payment in the three payment-first writers (review, refund, confirmFromWebhook). Pattern: first load the payment WITHOUT a lock only to read `payment.getAppointment().getId()` (a plain repository read is fine), then `appointmentRepository.findByIdWithDetailsForUpdate(appointmentId)`, then `paymentRepository.findByIdForUpdate(paymentId)`, then re-run the state checks on the now-locked appointment. Use the already-injected repositories; do NOT add @Version to Appointment (that's a migration out of scope). Where a whole-entity appointment save is only needed to update paymentStatus, keep the existing save style — lock acquisition order is the fix, not a persistence redesign. Add ONE deterministic unit-level test (mocked repos) asserting review acquires the appointment lock before the payment lock via in-order verification, plus a Testcontainers-free note that the live interleaving check is deferred to the Team Lead's container run.

2) HIGH — getForPatient returns 409 after cancellation instead of the committed payment row.
   Fix: in `getForPatient`, after ownership check, first look up the persisted payment; if one exists return it (any status). Only call ensurePayable + initialize when no payment row exists yet (so creation-after-cancel still fails with the existing conflict message). Add a service-level test: cancelled appointment + existing REFUND_PENDING payment → GET returns the row, no exception.

3) MEDIUM — invoice PDF re-renders the LIVE payment status on every download instead of the issuance-time snapshot.
   Fix: add a persisted status snapshot to PaymentInvoice (new `status` column, e.g. `status_snapshot varchar(32)`), populated in `issue()` from `statusSnapshot(payment.getStatus()).name()`; render every download from `invoice.getStatusSnapshot()` mapped back to the enum. Write the Flyway migration at the next free V-number: `alter table payment_invoices add column status_snapshot varchar(32) not null default 'PAID'` (default chosen because invoices can only be issued from PAID-or-later states — PAID is the only value existing rows could have had). Update the entity, the issue path, and receiptFor to use the stored value. Add/adjust a service test proving that after PAID→REFUND_PENDING→REFUNDED transitions, the re-downloaded receipt still reports the issuance snapshot.

4) MEDIUM — PaymentStatusEmailService skips delivery when only the API sender is configured, and repeated rejections can dedup into one email.
   Fix in PaymentStatusEmailService only: (a) inspect AfterCommitEmailSender — find the method that reflects the actual send-path availability used by sendTemplateBestEffort (it checks the API-preferred route too); if a suitable public method exists, call it, otherwise call `sendTemplateBestEffort` directly and let its internal best-effort handling decide (remove the narrower early-return). State in your report which branch you took and why. (b) For dedup: inspect EmailOutboxService's idempotency-key derivation — if it hashes all template variables, add a variable that is stable per business transition, e.g. `"transitionKey" = payment.getId() + ":" + payment.getUpdatedAt()` (epoch or toString as the codebase prefers); if it only hashes rendered text, report that and instead pass a distinguishing variable anyway if the contract tolerates unused vars. Do NOT edit EmailOutboxService. Add a unit test covering that two successive rejections of the same payment produce different variable maps.

5) MEDIUM — `ensurePayable` permits COMPLETED appointments even though the documented invariant says an ended appointment must never become PAID.
   Fix: reject `COMPLETED` in ensurePayable with the existing "Lịch hẹn đã kết thúc…" conflict phrasing (mirror the NO_SHOW branch). Do NOT touch CHECKED_IN/IN_PROGRESS — counter-side payment during an active visit remains a product decision and stays allowed. Add a service test for the COMPLETED reject on both submit and review paths if the harness makes it cheap; otherwise one submit-path test.

6) (Only if trivial) F7 generic integrity conflict on cross-appointment idempotency reuse — if adding one repository lookup `findBySubmissionIdempotencyKey` and a specific 409 message is clean, do it; otherwise DEFER with a note. Do not redesign.

Verification: `git diff` review + `node -e` is not applicable — you may run NOTHING that compiles Java. Produce a careful self-review of the diff for compile errors (imports, generics, missing methods) before reporting. All compile/test runs are the Team Lead's — mark NOT_RUN.

Return: full `git diff` per file, before/after git hash-object, per-finding status (FIXED-PENDING-COMPILE / DEFERRED+reason), the migration version chosen, and anything that contradicted the assigned design — stop and report instead of improvising. No user communication, no production, no release claims.
