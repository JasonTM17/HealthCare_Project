import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"
INITIAL_MIGRATION = MIGRATIONS_DIR / "20260822101722_healthcare_data_platform.sql"
SEED_FILE = REPO_ROOT / "supabase" / "seed.sql"


def normalize_sql(sql: str) -> str:
    return " ".join(sql.lower().split())


class StaticSqlAuthorityContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
        cls.migrations = {
            path: path.read_text(encoding="utf-8") for path in cls.migration_files
        }
        cls.all_migrations = "\n".join(cls.migrations.values())
        cls.initial = INITIAL_MIGRATION.read_text(encoding="utf-8")
        cls.seed = SEED_FILE.read_text(encoding="utf-8")

    def test_migrations_do_not_use_supabase_auth_as_identity_authority(self) -> None:
        forbidden_tokens = (
            "references auth.users",
            "auth.uid(",
            "auth.jwt(",
            "create or replace function healthcare.is_admin",
        )

        authority_artifacts = {**self.migrations, SEED_FILE: self.seed}
        for path, sql in authority_artifacts.items():
            normalized = normalize_sql(sql)
            for token in forbidden_tokens:
                with self.subTest(path=path.name, token=token):
                    self.assertNotIn(token, normalized)

        normalized_initial = normalize_sql(self.initial)
        self.assertIn(
            "constraint customers_no_supabase_auth_link check (auth_user_id is null)",
            normalized_initial,
        )

    def test_customer_and_patient_mirrors_are_server_only_from_initial_state(self) -> None:
        normalized_initial = normalize_sql(self.initial)
        for table in ("customers", "patient_profiles"):
            self.assertIn(
                f"alter table healthcare.{table} enable row level security;",
                normalized_initial,
            )

        self.assertIn(
            "revoke all privileges on table healthcare.customers, "
            "healthcare.patient_profiles from anon, authenticated;",
            normalized_initial,
        )

        policy_targets = re.findall(
            r"create\s+policy\s+\S+\s+on\s+healthcare\.([a-z_][a-z0-9_]*)",
            self.all_migrations,
            flags=re.IGNORECASE,
        )
        self.assertFalse(
            {"customers", "patient_profiles"}.intersection(policy_targets),
            "customer and patient mirrors must not have browser policies",
        )

        grant_statements = re.findall(
            r"\bgrant\b.*?;", self.all_migrations, flags=re.IGNORECASE | re.DOTALL
        )
        for statement in grant_statements:
            normalized = normalize_sql(statement)
            targets_mirror = (
                "healthcare.customers" in normalized
                or "healthcare.patient_profiles" in normalized
                or "all tables in schema healthcare" in normalized
            )
            grants_browser_role = re.search(
                r"\bto\b[^;]*\b(?:anon|authenticated)\b", normalized
            )
            with self.subTest(statement=normalized):
                self.assertFalse(targets_mirror and grants_browser_role)

    def test_migrations_create_no_chat_history_tables(self) -> None:
        table_names = re.findall(
            r"create\s+table(?:\s+if\s+not\s+exists)?\s+"
            r"healthcare\.([a-z_][a-z0-9_]*)",
            self.all_migrations,
            flags=re.IGNORECASE,
        )
        chat_tables = [
            name
            for name in table_names
            if re.search(r"chat|conversation|message", name, flags=re.IGNORECASE)
        ]
        self.assertEqual([], chat_tables)

    def test_seed_contract_is_synthetic_only(self) -> None:
        normalized_initial = normalize_sql(self.initial)
        self.assertIn("synthetic boolean not null default true", normalized_initial)
        self.assertIn(
            "constraint customers_synthetic_only check (synthetic)",
            normalized_initial,
        )

        customer_seed = re.search(
            r"insert\s+into\s+healthcare\.customers\s*\((.*?)\)\s*"
            r"select\s+(.*?)\s+from\s+generate_series\(1,\s*10000\)\s+as\s+i\s*;",
            self.seed,
            flags=re.IGNORECASE | re.DOTALL,
        )
        self.assertIsNotNone(customer_seed)
        assert customer_seed is not None
        columns, values = customer_seed.groups()
        self.assertIn("synthetic", columns.lower())
        self.assertRegex(
            values.lower(),
            r"md5\('large-user:'\s*\|\|\s*i::text\)::uuid,\s*null,",
        )
        self.assertRegex(values.lower().strip(), r",\s*true$")
        self.assertIn("@healthcare.local", self.seed.lower())

        normalized_seed = normalize_sql(self.seed)
        self.assertIn("from healthcare.customers c", normalized_seed)
        self.assertIn(
            "where substring(c.customer_code from 4)::integer <= 7500;",
            normalized_seed,
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
