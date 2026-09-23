-- V86/V87 inserted synthetic document metadata without writing PDF objects.
-- Their empty-content SHA-256 and 384512-byte size were placeholders, so an
-- AVAILABLE status promised a download that could only fail. Preserve the rows
-- and source links, but let the document center show the honest FAILED state.
-- The generation endpoint can create an object-backed PDF from the source.
-- Restrict this correction to the fourteen known seed IDs and original marker
-- values; a document that has since been regenerated is left untouched.
UPDATE patient_documents
   SET status = 'FAILED',
       sha256 = NULL,
       byte_size = NULL
 WHERE id IN (
    '80000000-0000-0000-00a0-000000000001',
    '80000000-0000-0000-00a0-000000000002',
    '80000000-0000-0000-00a0-000000000003',
    '80000000-0000-0000-00a0-000000000004',
    '80000000-0000-0000-00a0-000000000005',
    '80000000-0000-0000-00a0-000000000006',
    '80000000-0000-0000-00a0-000000000007',
    '80000000-0000-0000-00a0-000000000008',
    '80000000-0000-0000-00a0-000000000009',
    '80000000-0000-0000-00a0-00000000000a',
    '90000000-0000-0000-0018-000000000001',
    '90000000-0000-0000-0018-000000000002',
    '90000000-0000-0000-0018-000000000003',
    '90000000-0000-0000-0018-000000000004'
 )
   AND source_type = 'VISIT_SUMMARY'
   AND source_version = 1
   AND template_version = 'v1.0'
   AND status = 'AVAILABLE'
   AND object_key LIKE 'documents/clinical-summary-%'
   AND sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
   AND byte_size = 384512;
