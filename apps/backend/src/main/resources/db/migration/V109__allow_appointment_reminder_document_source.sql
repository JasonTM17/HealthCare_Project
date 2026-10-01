-- V109 (F1): widen the patient_documents source-type CHECK to include
-- APPOINTMENT_REMINDER. V71 defined the CHECK inline with only
-- ('VISIT_SUMMARY','PRESCRIPTION'), predating DocumentSourceType.APPOINTMENT_REMINDER;
-- every reminder generation therefore failed at INSERT with a DataIntegrityViolation
-- that surfaced to the caller as a 500 (regression test:
-- com.healthcare.document.DocumentGenerationIntegrationTest).
--
-- Constraint name is NOT guessed: because V71 left it unnamed, PostgreSQL
-- auto-generated patient_documents_source_type_check. Verified live on
-- pg_constraint before writing this migration. This migration drops/re-adds
-- exactly that one constraint; the other CHECKs on patient_documents
-- (patient_documents_object_key_safe, patient_documents_object_metadata_by_status,
-- patient_documents_revoked_requires_timestamp, patient_documents_status_check)
-- are untouched. The DROP ... IF EXISTS followed by ADD ordering is idempotent
-- against a re-run. Existing rows carry only the two old values, so widening
-- the list validates cleanly.
--
-- Provenance note (unchanged from V71): every patient_documents row is a
-- synthetic demo export; it is never a legally signed record, a diagnostic,
-- or an accounting receipt.

ALTER TABLE patient_documents
    DROP CONSTRAINT IF EXISTS patient_documents_source_type_check;

ALTER TABLE patient_documents
    ADD CONSTRAINT patient_documents_source_type_check
    CHECK (source_type IN ('VISIT_SUMMARY', 'PRESCRIPTION', 'APPOINTMENT_REMINDER'));
