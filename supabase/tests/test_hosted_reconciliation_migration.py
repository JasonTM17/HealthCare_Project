"""Static gates for the hosted-state-aware Supabase reconciliation."""

from pathlib import Path
import re
import unittest


MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "supabase"
    / "migrations"
    / "20260830102500_reconcile_hosted_clinical_projection_security.sql"
)


def normalize(sql: str) -> str:
    return " ".join(sql.lower().split())


class HostedReconciliationMigrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.sql = MIGRATION.read_text(encoding="utf-8")
        cls.normalized = normalize(cls.sql)

    def test_migration_is_transactional_bounded_and_additive(self) -> None:
        self.assertIn("begin;", self.normalized)
        self.assertTrue(self.normalized.endswith("commit;"))
        self.assertIn("set local lock_timeout = '5s'", self.normalized)
        self.assertIn("set local statement_timeout = '120s'", self.normalized)
        self.assertIn("set local search_path = pg_catalog, extensions", self.normalized)
        self.assertNotRegex(
            self.normalized,
            r"\b(?:drop\s+table|delete\s+from|create\s+table)\b",
        )
        self.assertNotIn("truncate;", self.normalized)

    def test_catalog_delta_is_guarded_and_target_scoped(self) -> None:
        for table in ("articles", "specialties", "faqs"):
            self.assertIn(f"alter table healthcare.{table}", self.normalized)
        self.assertIn("add column if not exists tombstone_revision bigint", self.normalized)
        self.assertIn("drop constraint if exists ai_documents_source_type", self.normalized)
        self.assertIn("conrelid = 'healthcare.articles'::regclass", self.normalized)
        self.assertIn("conrelid = 'healthcare.specialties'::regclass", self.normalized)
        self.assertIn("conrelid = 'healthcare.faqs'::regclass", self.normalized)
        self.assertIn("$column_compatibility$", self.normalized)
        self.assertIn("$existing_constraint_compatibility$", self.normalized)
        self.assertIn("$existing_index_compatibility$", self.normalized)

    def test_baseline_fingerprint_fails_closed(self) -> None:
        self.assertIn("baseline rls state is weaker than the reviewed target", self.normalized)
        self.assertIn("branches', 'doctors', 'services', 'packages'", self.normalized)
        self.assertIn("healthcare contains a policy outside the reviewed exact allowlist", self.normalized)
        self.assertIn("baseline policy healthcare.% is missing", self.normalized)
        self.assertIn("server-only healthcare tables have an unexpected browser policy", self.normalized)
        self.assertIn("baseline chat retrieval authority/acl is not the reviewed shape", self.normalized)
        self.assertIn("required extensions.vector type is missing", self.normalized)
        self.assertIn("unexpected competing ai_documents source_type constraint", self.normalized)
        self.assertIn("policy_roles <> array['anon'::name, 'authenticated'::name]", self.normalized)
        self.assertIn("policy_command <> 'select'", self.normalized)
        self.assertIn("policy_check is not null", self.normalized)
        self.assertIn("policy outside the reviewed exact allowlist", self.normalized)
        self.assertIn("healthcare schema role privileges are not the reviewed shape", self.normalized)
        self.assertIn("browser table privileges exceed the reviewed select-only allowlist", self.normalized)
        self.assertIn("healthcare table acl contains an unexpected grantee", self.normalized)
        self.assertIn("baseline chat retrieval body/security/search_path fingerprint drifted", self.normalized)
        self.assertIn("baseline updated_at function fingerprint drifted", self.normalized)
        self.assertIn("pg_get_triggerdef(t.oid)", self.normalized)
        self.assertIn("n.nspname = 'extensions'", self.normalized)
        self.assertIn("t.typname = 'vector'", self.normalized)
        self.assertIn("a.atttypmod = 384", self.normalized)
        self.assertIn("embedding vector contract is not extensions.vector(384)", self.normalized)
        self.assertIn("('ai_chat_documents', 'embedding', 'user-defined', 'yes')", self.normalized)

    def test_chat_baseline_fingerprint_matches_live_projection_contract(self) -> None:
        """Keep the guard aligned with the reviewed four-migration baseline.

        PostgreSQL can emit the same ``extensions.vector`` argument as either a
        qualified or bare type depending on the caller's ``search_path``.  The
        migration canonicalizes that representation before hashing, while the
        separate type/typmod checks keep the vector identity load-bearing.
        """
        self.assertIn(
            "replace(lower(pg_get_functiondef(p.oid)), 'extensions.vector', 'vector')",
            self.normalized,
        )
        self.assertIn("= 'e5032819be774757b87dcfa208fe45d9'", self.normalized)
        self.assertNotIn("a8ef57bb1fd42243d9f02380799f8baf", self.normalized)

    def test_pgvector_constraint_deparser_is_search_path_independent(self) -> None:
        self.assertIn("replace( regexp_replace(lower(definition)", self.normalized)
        self.assertIn("'extensions.vector_dims', 'vector_dims'", self.normalized)
        self.assertIn("'check (((embedding is null) or (vector_dims(embedding) = 384)))'", self.normalized)

    def test_existing_trigger_fingerprints_canonicalize_schema_qualification(self) -> None:
        self.assertIn("'healthcare.touch_updated_at()', 'touch_updated_at()'", self.normalized)
        self.assertIn("'touch_updated_at()', 'healthcare.touch_updated_at()'", self.normalized)
        self.assertIn(
            "'healthcare.ai_chat_documents_tombstone_guard()', 'ai_chat_documents_tombstone_guard()'",
            self.normalized,
        )

    def test_all_columns_used_by_projection_are_baseline_fingerprinted(self) -> None:
        for column in (
            "('ai_documents', 'embedding')",
            "('ai_documents', 'deleted_at')",
            "('ai_chat_documents', 'embedding_model')",
            "('ai_chat_documents', 'embedding_provenance')",
            "('ai_chat_documents', 'approval_round')",
            "('ai_chat_documents', 'approval_expires_at')",
        ):
            self.assertIn(column, self.normalized)

    def test_existing_function_and_trigger_drift_is_not_silently_replaced(self) -> None:
        self.assertIn("existing tombstone guard function is not the reviewed implementation", self.normalized)
        self.assertIn("existing tombstone trigger points to an unexpected function", self.normalized)
        self.assertIn("existing tombstone trigger is not the reviewed exact definition", self.normalized)
        self.assertIn("t.tgtype = 19", self.normalized)
        self.assertIn("t.tgtype = 23", self.normalized)
        self.assertIn("169a6d1f37436d6ccc49e3624de7455c", self.normalized)
        self.assertIn("existing ai_documents_source_type constraint is incompatible", self.normalized)
        self.assertIn("existing ai_chat_documents.tombstone_revision is incompatible", self.normalized)
        self.assertIn("md5(regexp_replace(lower(p.prosrc)", self.normalized)
        self.assertIn("$projection_constraint_compatibility$", self.normalized)
        self.assertIn("baseline ai_chat_documents unique source contract is missing or incompatible", self.normalized)
        self.assertIn("existing list projection page function is not the reviewed implementation", self.normalized)
        self.assertIn("existing match projection page function is not the reviewed implementation", self.normalized)
        self.assertIn("existing list projection page acl contains an unexpected grantee", self.normalized)
        self.assertIn("existing match projection page acl contains an unexpected grantee", self.normalized)
        self.assertIn("existing healthcare index % is incompatible", self.normalized)
        self.assertIn("not is_validated", self.normalized)
        self.assertIn("not is_valid", self.normalized)
        self.assertIn("expected_definition", self.normalized)

    def test_existing_hosted_triggers_are_not_recreated(self) -> None:
        self.assertNotIn("create trigger synthetic_seed_runs_touch_updated_at", self.normalized)
        self.assertNotIn("create trigger synthetic_seed_chunks_touch_updated_at", self.normalized)
        self.assertRegex(
            self.normalized,
            r"drop trigger if exists ai_chat_documents_tombstone_guard .*?"
            r"create trigger ai_chat_documents_tombstone_guard",
        )
        self.assertIn("t.tgtype = 19", self.normalized)
        self.assertIn("t.tgenabled = 'o'", self.normalized)
        self.assertIn("t.tgfoid = touch_oid", self.normalized)
        self.assertIn("pg_get_triggerdef(t.oid)", self.normalized)

    def test_projection_functions_and_tables_remain_service_only(self) -> None:
        for function_name in (
            "healthcare.list_chat_documents_page",
            "healthcare.match_chat_documents_page",
        ):
            self.assertIn(f"create or replace function {function_name}", self.normalized)
            self.assertRegex(
                self.normalized,
                rf"revoke all on function {re.escape(function_name)}.*?"
                r"from public, anon, authenticated",
            )
            self.assertRegex(
                self.normalized,
                rf"grant execute on function {re.escape(function_name)}.*?to service_role",
            )
        self.assertIn("alter table healthcare.ai_chat_documents enable row level security", self.normalized)
        self.assertIn("from public, anon, authenticated", self.normalized)
        self.assertIn("has_table_privilege('anon', 'healthcare.ai_chat_documents', 'select')", self.normalized)

    def test_public_security_definer_helper_is_locked_down(self) -> None:
        self.assertIn("if to_regprocedure('public.rls_auto_enable()') is not null", self.normalized)
        self.assertIn("from public, anon, authenticated, service_role", self.normalized)
        self.assertIn("to postgres", self.normalized)
        self.assertIn("platform event-trigger helper remains externally executable", self.normalized)

    def test_reconciliation_adds_no_identity_or_chat_history(self) -> None:
        for token in (
            "references auth.users",
            "auth.uid(",
            "patient_id",
            "user_id",
            "conversation_id",
            "message_id",
        ):
            self.assertNotIn(token, self.normalized)


if __name__ == "__main__":
    unittest.main(verbosity=2)
