"""Static contract for the exact post-apply Free-plan rollback capsule."""

from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
CAPSULE = ROOT / "supabase" / "reconciliation" / "free-plan-rollback-writer-lock-20260830.sql"


class WriterLockRollbackContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.raw = CAPSULE.read_text(encoding="utf-8")
        cls.sql = " ".join(cls.raw.lower().split())

    def test_is_transactional_target_bound_and_non_history_rewriting(self) -> None:
        self.assertTrue(self.sql.startswith("-- target-specific compensating rollback"))
        self.assertIn("begin;", self.sql)
        self.assertTrue(self.sql.endswith("commit;"))
        self.assertIn("7666007964130682852", self.sql)
        self.assertIn("rollback history is not the exact observed eight-row state", self.sql)
        self.assertIn("141b596b4ebe0867cda9a7d6a1311b82", self.sql)
        self.assertIn("never rewrites the", self.sql)
        self.assertIn("provider migration history", self.sql)
        self.assertNotRegex(self.sql, r"\b(?:delete\s+from|truncate)\b")

    def test_locks_every_mutated_table_in_stable_order(self) -> None:
        lock = re.search(r"lock table (.*?) in access exclusive mode", self.sql)
        self.assertIsNotNone(lock)
        self.assertEqual(
            re.sub(r"\s+", " ", lock.group(1).strip()),
            "healthcare.articles, healthcare.specialties, healthcare.faqs, healthcare.ai_documents, healthcare.ai_chat_documents",
        )
        self.assertIn("set local lock_timeout = '5s'", self.sql)

    def test_every_forward_object_has_a_shape_guard_and_drop(self) -> None:
        for name in (
            "content_language", "audience", "topic_tags", "key_takeaways",
            "warning_signs", "prevention_tips", "when_to_seek_care",
            "source_references", "clinical_metadata", "clinical_disclaimer",
            "last_reviewed_at", "last_reviewed_by", "featured",
            "clinical_overview", "common_conditions", "red_flags",
            "preventive_care", "category", "related_specialty_slug",
            "sort_order", "tombstone_revision",
        ):
            self.assertRegex(self.sql, rf"drop column\s+{name}\b")
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
            "reconciliation index definition drifted",
            "reconciliation constraint definition drifted",
            "candidate column definition drifted",
        ):
            self.assertIn(phrase, self.sql)

    def test_blocks_post_apply_writes_and_preserves_hardened_helper(self) -> None:
        for phrase in (
            "data changed after the free-plan baseline; rollback is unsafe",
            "new article columns contain post-apply data; rollback is unsafe",
            "new specialty columns contain post-apply data; rollback is unsafe",
            "new faq columns contain post-apply data; rollback is unsafe",
            "tombstone_revision contains post-apply data; rollback is unsafe",
            "xmin::text",
            "baseline row fingerprint drifted",
            "platform helper post-apply acl/comment/owner drifted",
            "platform helper acl/comment/owner was not preserved",
            "revoke all on function public.rls_auto_enable()",
            "grant execute on function public.rls_auto_enable() to postgres",
        ):
            self.assertIn(phrase, self.sql)
        self.assertNotIn("comment on function public.rls_auto_enable() is null", self.sql)


if __name__ == "__main__":
    unittest.main(verbosity=2)
