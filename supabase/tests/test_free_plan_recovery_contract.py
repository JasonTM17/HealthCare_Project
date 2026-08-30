"""Static contract for the Supabase Free-plan recovery capsule."""

from pathlib import Path
import json
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
RECONCILIATION = ROOT / "supabase" / "reconciliation"
BASELINE = RECONCILIATION / "free-plan-baseline-20260830.json"
PREAPPLY = RECONCILIATION / "free-plan-preapply.sql"
ROLLBACK = RECONCILIATION / "free-plan-rollback.sql"
REAPPLY_PREAPPLY = RECONCILIATION / "free-plan-reapply-preapply.sql"
LOCK_DOWN_HELPER = RECONCILIATION / "free-plan-lock-down-helper.sql"


class FreePlanRecoveryContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.preapply_raw = PREAPPLY.read_text(encoding="utf-8")
        cls.preapply = " ".join(PREAPPLY.read_text(encoding="utf-8").lower().split())
        cls.rollback = " ".join(ROLLBACK.read_text(encoding="utf-8").lower().split())
        cls.reapply_preapply = " ".join(
            REAPPLY_PREAPPLY.read_text(encoding="utf-8").lower().split()
        )
        cls.lock_down_helper = " ".join(
            LOCK_DOWN_HELPER.read_text(encoding="utf-8").lower().split()
        )
        cls.baseline = json.loads(BASELINE.read_text(encoding="utf-8"))

    def test_baseline_is_named_and_free_only(self) -> None:
        self.assertEqual(self.baseline["project_ref"], "awaknzhadjglbfkhigck")
        self.assertIn("free", self.baseline["plan_constraint"].lower())
        self.assertEqual(self.baseline["postgres_system_identifier"], "7666007964130682852")
        self.assertEqual(
            self.baseline["migration_history"],
            ["20260823085754", "20260823085812", "20260823102718", "20260824102515"],
        )
        self.assertEqual(self.baseline["row_state"]["ai_chat_documents"]["deleted_count"], 0)
        self.assertEqual(
            set(self.baseline["row_fingerprints"])
            - {"method", "note"},
            {"articles", "specialties", "faqs", "ai_documents", "ai_chat_documents"},
        )

    def test_preapply_is_read_only_and_fails_closed(self) -> None:
        self.assertIn("begin transaction read only", self.preapply)
        self.assertTrue(self.preapply.endswith("rollback;"))
        self.assertIn("free_plan_preapply_ok", self.preapply)
        self.assertIn("migration history/name drifted before free-plan apply", self.preapply)
        self.assertIn("baseline row counts or update watermarks drifted", self.preapply)
        self.assertIn("pg_control_system()", self.preapply)
        self.assertIn("candidate tombstone guard function already exists", self.preapply)
        self.assertIn("baseline row fingerprint drifted", self.preapply)
        # Ignore prose/comments; the remaining SQL must not contain a DDL/DML
        # statement at the beginning of a line.
        executable = re.sub(r"--[^\r\n]*", "", self.preapply_raw, flags=re.MULTILINE)
        self.assertNotRegex(
            executable,
            r"(?im)^\s*(?:insert|update|delete|alter|drop|create)\s+",
        )

    def test_rollback_is_transactional_and_never_rewrites_history(self) -> None:
        self.assertTrue(self.rollback.startswith("-- target-specific rollback"))
        self.assertIn("begin;", self.rollback)
        self.assertTrue(self.rollback.endswith("commit;"))
        self.assertNotIn("delete from", self.rollback)
        self.assertNotIn("truncate", self.rollback)
        self.assertIn("select count(*)", self.rollback)
        self.assertIn("from supabase_migrations.schema_migrations", self.rollback)
        self.assertIn("no migration-history row is rewritten", self.rollback)
        self.assertIn("exact observed five-row state", self.rollback)
        self.assertIn("a6be7e503ca7505a07a7df4fe864e9b0", self.rollback)
        self.assertIn("7666007964130682852", self.rollback)
        self.assertIn("system_identifier", self.rollback)
        self.assertIn("lock table healthcare.articles", self.rollback)
        self.assertIn("in access exclusive mode", self.rollback)

    def test_every_forward_added_column_has_a_guarded_drop(self) -> None:
        columns = (
            "content_language", "audience", "topic_tags", "key_takeaways",
            "warning_signs", "prevention_tips", "when_to_seek_care",
            "source_references", "clinical_metadata", "clinical_disclaimer",
            "last_reviewed_at", "last_reviewed_by", "featured",
            "clinical_overview", "common_conditions", "red_flags",
            "preventive_care", "category", "related_specialty_slug",
            "sort_order", "tombstone_revision",
        )
        for column in columns:
            self.assertRegex(self.rollback, rf"drop column\s+{column}\b")
            self.assertIn(column, self.rollback)

    def test_rollback_restores_load_bearing_security_and_constraint_state(self) -> None:
        for phrase in (
            "drop function healthcare.match_chat_documents_page",
            "drop function healthcare.list_chat_documents_page",
            "drop trigger ai_chat_documents_tombstone_guard",
            "drop function healthcare.ai_chat_documents_tombstone_guard",
            "drop constraint ai_chat_documents_tombstone_shape",
            "drop constraint articles_rich_content_shape",
            "drop constraint specialties_rich_content_shape",
            "drop constraint faqs_rich_content_shape",
            "drop constraint ai_documents_source_type",
            "baseline source_type constraint was not restored",
            "platform helper baseline acl/comment/owner was not restored",
            "platform helper post-apply acl/comment/owner drifted",
            "reconciliation tombstone guard definition fingerprint drifted",
            "reconciliation list function definition fingerprint drifted",
            "reconciliation match function definition fingerprint drifted",
            "reconciliation index definition fingerprint drifted",
            "reconciliation constraint definition fingerprint drifted",
            "reconciliation column definition drifted",
            "md5((to_jsonb(t) - $1::text[])::text)",
        ):
            self.assertIn(phrase, self.rollback)
        self.assertIn("grant execute on function public.rls_auto_enable()", self.rollback)
        self.assertIn("comment on function public.rls_auto_enable() is null", self.rollback)
        self.assertIn("no migration-history row is rewritten", self.rollback)

    def test_rollback_blocks_post_apply_writes(self) -> None:
        for phrase in (
            "data changed after the free-plan baseline; rollback is unsafe",
            "new catalog columns contain post-apply data; rollback is unsafe",
            "where source_type = 'branch'",
            "where deleted_at is not null",
            "where tombstone_revision is not null",
            "xmin::text",
            "post-rollback row fingerprint mismatch",
        ):
            self.assertIn(phrase, self.rollback)

    def test_reapply_gate_accepts_only_the_observed_audited_history(self) -> None:
        self.assertIn("begin transaction read only", self.reapply_preapply)
        self.assertTrue(self.reapply_preapply.endswith("rollback;"))
        self.assertIn("free_plan_reapply_preapply_ok", self.reapply_preapply)
        for entry in (
            "20260830075505:reconcile_hosted_clinical_projection_security",
            "20260830075737:rollback_free_plan_reconciliation_20260830",
            "20260830080646:lock_down_public_event_trigger_free_plan_20260830",
        ):
            self.assertIn(entry, self.reapply_preapply)
        self.assertIn("free-plan reapply history is not the reviewed seven-row state", self.reapply_preapply)
        self.assertIn("hardened acl/comment drifted", self.reapply_preapply)
        self.assertIn("pg_control_system()", self.reapply_preapply)
        self.assertIn("a6be7e503ca7505a07a7df4fe864e9b0", self.reapply_preapply)
        self.assertIn("9d091b4911befb714b7a3adec6aa17f9", self.reapply_preapply)
        self.assertIn("1cd1aa7d221ac68192ed052be5eb8071", self.reapply_preapply)
        self.assertIn("baseline row fingerprint drifted", self.reapply_preapply)
        self.assertIn("helper_acl <> '{postgres=x/postgres}'", self.reapply_preapply)
        self.assertIn("never concatenate the forward and rollback sql", self.reapply_preapply)

    def test_helper_hardening_is_one_time_and_fail_closed(self) -> None:
        self.assertIn("begin;", self.lock_down_helper)
        self.assertTrue(self.lock_down_helper.endswith("commit;"))
        self.assertIn("revoke execute on function public.rls_auto_enable()", self.lock_down_helper)
        self.assertIn("from public, anon, authenticated, service_role", self.lock_down_helper)
        self.assertIn("grant execute on function public.rls_auto_enable() to postgres", self.lock_down_helper)
        self.assertIn("platform helper hardening postcondition failed", self.lock_down_helper)
        self.assertIn("helper lockdown history is not the exact observed six-row state", self.lock_down_helper)
        self.assertIn("not re-runnable after its own audit row is recorded", self.lock_down_helper)
        self.assertIn("pg_control_system()", self.lock_down_helper)
        self.assertIn("obj_description(helper_oid, 'pg_proc') is distinct from", self.lock_down_helper)
        self.assertIn("<> '{postgres=x/postgres}'", self.lock_down_helper)
        self.assertNotRegex(self.lock_down_helper, r"\b(?:insert|update|delete|truncate)\b")


if __name__ == "__main__":
    unittest.main(verbosity=2)
