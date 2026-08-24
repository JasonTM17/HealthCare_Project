"""Static gates for the additive clinical projection/tombstone migration.

These checks intentionally do not connect to a hosted Supabase project.  The
SQL integration gate (``clinical_projection_pagination_branch_tombstones.sql``)
is run against a disposable local PostgreSQL/Supabase database instead.
"""

from pathlib import Path
import re
import unittest


REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATION = (
    REPO_ROOT
    / "supabase"
    / "migrations"
    / "20260824113025_clinical_projection_pagination_branch_tombstones.sql"
)


def normalize(sql: str) -> str:
    return " ".join(sql.lower().split())


class ClinicalProjectionContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.sql = MIGRATION.read_text(encoding="utf-8")
        cls.normalized = normalize(cls.sql)

    def test_migration_is_non_empty_and_transactional(self) -> None:
        self.assertGreater(len(self.sql.strip()), 1000)
        self.assertTrue(self.normalized.startswith("--"))
        self.assertIn("begin;", self.normalized)
        self.assertIn("commit;", self.normalized)

    def test_branch_and_rich_clinical_catalog_contract(self) -> None:
        self.assertIn("source_type in ('specialty', 'doctor', 'branch'", self.normalized)
        for table in ("articles", "specialties", "faqs"):
            self.assertIn(f"alter table healthcare.{table}", self.normalized)
        self.assertIn("where source_type = 'branch' and active", self.normalized)
        self.assertIn("published and deleted_at is null", self.normalized)

    def test_tombstone_contract_is_monotonic_and_fail_closed(self) -> None:
        self.assertIn("tombstone_revision bigint", self.normalized)
        self.assertIn("ai_chat_documents_tombstone_shape", self.normalized)
        self.assertIn("ai_chat_documents_tombstone_guard", self.normalized)
        self.assertIn("tg_op = 'update'", self.normalized)
        self.assertIn("eligibility revision cannot move backwards", self.normalized)
        self.assertIn("equal-revision projection update must be idempotent", self.normalized)
        self.assertIn("stale projection cannot resurrect a tombstone", self.normalized)

    def test_service_only_keyset_functions(self) -> None:
        for function_name in (
            "healthcare.list_chat_documents_page",
            "healthcare.match_chat_documents_page",
        ):
            self.assertIn(f"create or replace function {function_name}", self.normalized)
            self.assertRegex(
                self.normalized,
                rf"revoke all on function {re.escape(function_name)}.*?from public, anon, authenticated",
            )
            self.assertRegex(
                self.normalized,
                rf"grant execute on function {re.escape(function_name)}.*?to service_role",
            )
        self.assertIn("cursor_updated_at", self.normalized)
        self.assertIn("cursor_id", self.normalized)
        self.assertIn("after_score", self.normalized)
        self.assertIn("after_id", self.normalized)
        self.assertIn("limit least(greatest(coalesce(page_size, 500), 1), 500)", self.normalized)

    def test_projection_contains_no_patient_identity_columns(self) -> None:
        projection = re.search(
            r"create\s+table\s+healthcare\.ai_chat_documents\s*\((.*?)\);",
            self.normalized,
            flags=re.DOTALL,
        )
        # The table is created in the previous migration; this migration must
        # not introduce an identity-bearing projection shape either.
        self.assertIsNone(projection)
        for token in ("patient_id", "user_id", "conversation_id", "message_id"):
            self.assertNotIn(token, self.normalized)


if __name__ == "__main__":
    unittest.main(verbosity=2)
