"""Static security gate for the internal RLS event trigger migration."""

from pathlib import Path
import unittest


MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "supabase"
    / "migrations"
    / "20260824154423_lock_down_public_event_trigger.sql"
)


class EventTriggerPrivilegeContractTest(unittest.TestCase):
    def test_event_trigger_is_not_publicly_callable(self) -> None:
        sql = " ".join(MIGRATION.read_text(encoding="utf-8").lower().split())
        self.assertIn("if to_regprocedure('public.rls_auto_enable()') is not null", sql)
        self.assertIn("revoke execute on function public.rls_auto_enable()", sql)
        self.assertIn("from public, anon, authenticated, service_role", sql)
        self.assertIn("grant execute on function public.rls_auto_enable() to postgres", sql)

    def test_fresh_database_without_platform_helper_is_supported(self) -> None:
        sql = " ".join(MIGRATION.read_text(encoding="utf-8").lower().split())
        guard = sql.index("if to_regprocedure('public.rls_auto_enable()') is not null")
        revoke = sql.index("revoke execute on function public.rls_auto_enable()")
        self.assertLess(guard, revoke)
        self.assertIn("execute 'revoke execute on function", sql)


if __name__ == "__main__":
    unittest.main(verbosity=2)
