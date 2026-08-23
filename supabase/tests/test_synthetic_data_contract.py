import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
TOOL_PATH = REPO_ROOT / "supabase" / "tools" / "generate_synthetic_data.py"


def load_tool():
    spec = importlib.util.spec_from_file_location("synthetic_data_tool", TOOL_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {TOOL_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


tool = load_tool()


class SyntheticDataToolContractTest(unittest.TestCase):
    def make_args(self, output_dir: str):
        args = tool.build_parser().parse_args(["generate", "--output-dir", output_dir])
        tool.validate_config(args)
        return args

    def test_default_targets_are_chunked_in_dependency_order(self) -> None:
        args = self.make_args("unused")
        chunks = tool.build_chunks(args)

        self.assertEqual(
            ["CUSTOMER", "PATIENT_PROFILE", "PUBLIC_RAG_DOCUMENT"],
            list(dict.fromkeys(chunk.entity_type for chunk in chunks)),
        )
        self.assertEqual(20, sum(chunk.entity_type == "CUSTOMER" for chunk in chunks))
        self.assertEqual(15, sum(chunk.entity_type == "PATIENT_PROFILE" for chunk in chunks))
        self.assertEqual(2, sum(chunk.entity_type == "PUBLIC_RAG_DOCUMENT" for chunk in chunks))
        self.assertEqual((95001, 100000), (chunks[19].range_start, chunks[19].range_end))
        self.assertEqual((1, 5000), (chunks[20].range_start, chunks[20].range_end))
        self.assertEqual((70001, 75000), (chunks[34].range_start, chunks[34].range_end))
        self.assertEqual((1, 5000), (chunks[35].range_start, chunks[35].range_end))
        self.assertEqual((5001, 8520), (chunks[36].range_start, chunks[36].range_end))

    def test_generation_is_idempotent_and_resumes_missing_chunk(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            args = self.make_args(directory)
            manifest_path, first, changed = tool.write_or_resume(args)
            self.assertGreater(changed, 0)
            first_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            first_sql = (Path(directory) / first_manifest["chunks"][0]["sql_file"]).read_bytes()

            _, second, second_changed = tool.write_or_resume(args)
            self.assertEqual(0, second_changed)
            self.assertEqual(first["manifest_hash"], second["manifest_hash"])
            self.assertEqual(first_sql, (Path(directory) / first_manifest["chunks"][0]["sql_file"]).read_bytes())

            missing = Path(directory) / first_manifest["chunks"][0]["sql_file"]
            missing.unlink()
            _, resumed, resumed_changed = tool.write_or_resume(args)
            self.assertEqual(1, resumed_changed)
            self.assertEqual(first["manifest_hash"], resumed["manifest_hash"])
            self.assertTrue(missing.exists())

    def test_rendered_sql_is_set_based_synthetic_and_vector_profiled(self) -> None:
        args = self.make_args("unused")
        chunks = tool.build_chunks(args)
        customer_sql = tool.render_chunk(chunks[0], args).lower()
        rag_sql = tool.render_chunk(chunks[-1], args).lower()

        self.assertIn("generate_series(1, 5000)", customer_sql)
        self.assertIn("on conflict (customer_code) do nothing", customer_sql)
        self.assertIn("healthcare.synthetic_embedding", rag_sql)
        self.assertIn("embedding_dimension", rag_sql)
        self.assertIn("published_at", rag_sql)
        self.assertIn("content_hash", rag_sql)
        self.assertIn("sync_revision", rag_sql)
        self.assertIn("synthetic-article-", rag_sql)
        self.assertNotIn("auth.users", rag_sql)

    def test_manifest_checkpoint_sql_is_server_only_and_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            args = self.make_args(directory)
            _, manifest, _ = tool.write_or_resume(args)
            entry = manifest["chunks"][0]
            start_sql = tool.checkpoint_start_sql(manifest, entry).lower()
            complete_sql = tool.checkpoint_complete_sql(manifest, entry).lower()

            self.assertIn("synthetic_seed_runs", start_sql)
            self.assertIn("synthetic_seed_chunks", start_sql)
            self.assertIn("on conflict (dataset_key, dataset_version, seed)", start_sql)
            self.assertIn("on conflict (run_id, entity_type, chunk_no)", start_sql)
            self.assertIn("status = 'completed'", complete_sql)
            self.assertNotIn("anon", start_sql)
            self.assertNotIn("authenticated", start_sql)
            self.assertNotIn("auth.users", start_sql)

    def test_invalid_scale_contract_is_rejected(self) -> None:
        args = self.make_args("unused")
        args.patient_profiles = args.customers + 1
        with self.assertRaises(ValueError):
            tool.validate_config(args)


if __name__ == "__main__":
    unittest.main(verbosity=2)
