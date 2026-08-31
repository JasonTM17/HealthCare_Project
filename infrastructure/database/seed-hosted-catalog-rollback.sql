-- Target-specific compensating rollback for seed-hosted-catalog.sql.
--
-- This capsule is intentionally fail-closed.  It can remove only the exact
-- untouched Render Free beta snapshot recorded on 2026-08-30.  It refuses to
-- run after any booking, clinical, consultation, or other consumer row exists,
-- and it refuses if a seeded row was edited or an unexpected row was added.
-- It never rewrites Flyway history and never uses TRUNCATE or CASCADE.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

SELECT pg_advisory_xact_lock(
  hashtextextended('healthcare-hosted-catalog-seed-v1', 0)
);

-- A rollback is safe only before the disposable beta has received traffic.
DO $$
DECLARE
  table_name text;
  row_count bigint;
BEGIN
  FOR table_name IN
    SELECT unnest(ARRAY[
    'appointments',
    'medical_records',
    'diagnostic_results',
    'prescriptions',
    'prescription_items',
    'patient_consultation_threads',
    'patient_consultation_messages',
    'patient_consultation_attachments',
    'patient_consultation_events',
    'patient_consultation_participants',
    'patient_consultation_read_states',
    'patient_care_plans',
    'patient_care_plan_items',
    'doctor_schedule_exceptions'
    ])
  LOOP
    EXECUTE format('SELECT count(*) FROM %I', table_name) INTO row_count;
    IF row_count <> 0 THEN
      RAISE EXCEPTION 'hosted catalog rollback refused: % has % consumer rows',
        table_name, row_count;
    END IF;
  END LOOP;
END $$;

-- Lock in dependency order so a concurrent request cannot pass the checks and
-- then write a reference while the compensating delete is in progress.
LOCK TABLE
  appointments,
  medical_records,
  diagnostic_results,
  prescriptions,
  prescription_items,
  patient_consultation_threads,
  patient_consultation_messages,
  patient_consultation_attachments,
  patient_consultation_events,
  patient_consultation_participants,
  patient_consultation_read_states,
  patient_care_plans,
  patient_care_plan_items,
  doctor_schedule_exceptions,
  cms_contents,
  cms_content_changes,
  doctor_schedules,
  doctor_specialties,
  doctor_branches,
  articles,
  faqs,
  packages,
  services,
  doctors,
  branches,
  specialties
IN ACCESS EXCLUSIVE MODE;

-- Fingerprints are over canonical jsonb row representations, ordered by id.
-- They bind this capsule to the exact post-seed snapshot; an admin edit or
-- additional row makes the rollback abort rather than delete user work.
DO $$
DECLARE
  expected_row record;
  actual_count bigint;
  actual_fingerprint text;
  fingerprint_expression text;
BEGIN
  FOR expected_row IN
    SELECT *
    FROM (VALUES
      ('specialties'::text, 30::bigint, '899a9267602e4b60fafd6bece647f6df'::text),
      ('branches'::text, 20::bigint, '6fcd5df7f5e627c1022b3744972293e7'::text),
      ('doctors'::text, 500::bigint, '07198dcddf11eff03c7c38165c2035aa'::text),
      ('services'::text, 200::bigint, '2aeb6e31744bd84504d3ed7a2451f9f6'::text),
      ('packages'::text, 100::bigint, 'e517e4c93275d9b26b959ee5a367c61c'::text),
      -- V36 stamps updated_at with CURRENT_TIMESTAMP on insert, so the exact
      -- rollback identity excludes only that volatile column on these tables.
      ('articles'::text, 500::bigint, 'fa5fe51fd11cc521fed4f4d3a8495154'::text),
      ('faqs'::text, 150::bigint, 'd8c82adeac2eb30330a1d2626c47cf94'::text),
      ('doctor_specialties'::text, 1251::bigint, '959e409228543cbd157623fd23b35deb'::text),
      ('doctor_branches'::text, 751::bigint, 'f224056ac7909e83dd2e626e9b64685a'::text),
      ('doctor_schedules'::text, 7130::bigint, 'ddeb42964f8215b659a1782098441942'::text),
      ('cms_contents'::text, 5::bigint, 'd62093f80d7f8d08e99dad0bc15a8ea5'::text),
      ('cms_content_changes'::text, 0::bigint, 'd41d8cd98f00b204e9800998ecf8427e'::text)
    ) AS expected(table_name, expected_count, expected_fingerprint)
  LOOP
    fingerprint_expression := CASE
      WHEN expected_row.table_name IN ('articles', 'faqs')
        THEN 'to_jsonb(x) - ''updated_at'''
      ELSE 'to_jsonb(x)'
    END;
    EXECUTE format(
      'SELECT count(*), md5(coalesce(string_agg((%s)::text, '''' ORDER BY id), '''')) FROM %I x',
      fingerprint_expression,
      expected_row.table_name
    ) INTO actual_count, actual_fingerprint;
    IF actual_count <> expected_row.expected_count
       OR actual_fingerprint <> expected_row.expected_fingerprint THEN
      RAISE EXCEPTION
        'hosted catalog rollback refused: % fingerprint mismatch (expected %/% got %/%)',
        expected_row.table_name,
        expected_row.expected_count,
        expected_row.expected_fingerprint,
        actual_count,
        actual_fingerprint;
    END IF;
  END LOOP;
END $$;

-- Delete only after every guard has passed.  No migration-history row is
-- rewritten; this is a data rollback for the disposable seed only.
DELETE FROM doctor_schedules;
DELETE FROM doctor_specialties;
DELETE FROM doctor_branches;
DELETE FROM cms_content_changes;
DELETE FROM cms_contents;
DELETE FROM articles;
DELETE FROM faqs;
DELETE FROM packages;
DELETE FROM services;
DELETE FROM doctors;
DELETE FROM branches;
DELETE FROM specialties;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM specialties)
     OR EXISTS (SELECT 1 FROM branches)
     OR EXISTS (SELECT 1 FROM doctors)
     OR EXISTS (SELECT 1 FROM services)
     OR EXISTS (SELECT 1 FROM packages)
     OR EXISTS (SELECT 1 FROM articles)
     OR EXISTS (SELECT 1 FROM faqs)
     OR EXISTS (SELECT 1 FROM doctor_specialties)
     OR EXISTS (SELECT 1 FROM doctor_branches)
     OR EXISTS (SELECT 1 FROM doctor_schedules)
     OR EXISTS (SELECT 1 FROM cms_contents)
     OR EXISTS (SELECT 1 FROM cms_content_changes) THEN
    RAISE EXCEPTION 'hosted catalog rollback postcondition failed';
  END IF;
END $$;

COMMIT;
