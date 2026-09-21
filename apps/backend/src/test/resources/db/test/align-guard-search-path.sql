-- Re-points the search-path-pinned guard functions at the schema actually under
-- migration. Executed by CatalogFixtureCallback right before V86; see the
-- callback's Javadoc for why this exists (isolated-schema FlywayMigrationTest
-- runs vs. production's public schema).
--
-- SET search_path FROM CURRENT captures the callback connection's search_path,
-- which Flyway points at the schema being migrated. Static statements only —
-- the function list mirrors every migration-defined function whose body pins
-- `SET search_path = public, pg_catalog` (V24/V34/V38/V53/V66/V75/V80).
ALTER FUNCTION enforce_synthetic_fixture_guard() SET search_path FROM CURRENT;
ALTER FUNCTION health_question_answer_guard() SET search_path FROM CURRENT;
ALTER FUNCTION health_question_answer_immutable_delete() SET search_path FROM CURRENT;
ALTER FUNCTION health_question_owner_guard() SET search_path FROM CURRENT;
ALTER FUNCTION health_question_report_admin_guard() SET search_path FROM CURRENT;
ALTER FUNCTION health_question_report_immutable() SET search_path FROM CURRENT;
ALTER FUNCTION health_question_touch_updated_at() SET search_path FROM CURRENT;
ALTER FUNCTION patient_care_plan_appointment_owner_guard() SET search_path FROM CURRENT;
ALTER FUNCTION patient_care_plan_item_linkage_guard() SET search_path FROM CURRENT;
ALTER FUNCTION patient_care_plan_touch_updated_at() SET search_path FROM CURRENT;
ALTER FUNCTION patient_consultation_attachment_limit_guard() SET search_path FROM CURRENT;
ALTER FUNCTION patient_consultation_event_immutable() SET search_path FROM CURRENT;
ALTER FUNCTION patient_consultation_message_immutable() SET search_path FROM CURRENT;
ALTER FUNCTION patient_consultation_participant_guard() SET search_path FROM CURRENT;
ALTER FUNCTION patient_consultation_thread_touch_updated_at() SET search_path FROM CURRENT;
ALTER FUNCTION patient_consultation_thread_window_guard() SET search_path FROM CURRENT;
ALTER FUNCTION synthetic_beta_guard_touch_updated_at() SET search_path FROM CURRENT;
