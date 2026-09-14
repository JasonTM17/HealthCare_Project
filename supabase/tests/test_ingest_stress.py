"""Comprehensive empirical stress-testing suite for Supabase clinical knowledge ingestion CLI.

This suite stress-tests supabase/tools/ingest_clinical_knowledge.py against:
1. Corrupted JSON inputs (syntax errors, truncated JSON, empty file, non-JSON data, invalid root types).
2. Missing mandatory fields (title, content, source_type, source_id, whitespace-only/null values).
3. Out-of-range content lengths (< 1 char, > 20,000 chars, massive overflow, exact boundaries 1 & 20,000).
4. Invalid source_type (e.g. 'hospital', 'prescription', numeric, empty, unsupported types).
5. Invalid source_id characters (spaces, slashes, unicode symbols, emojis, length > 200).
6. Duplicate (source_type, source_id) records (in-memory deduplication, last-write-wins semantics).
7. CLI graceful exit codes (exit 0 on valid, non-zero on invalid with stderr diagnostics, no unhandled tracebacks).
8. Hypothesis property-based fuzzing for inputs.
"""

from __future__ import annotations

import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any

from hypothesis import given, settings, strategies as st

REPO_ROOT = Path(__file__).resolve().parents[2]
TOOL_PATH = REPO_ROOT / "supabase" / "tools" / "ingest_clinical_knowledge.py"
DATA_PATH = REPO_ROOT / "supabase" / "tools" / "data" / "clinical_knowledge.json"

spec = importlib.util.spec_from_file_location("ingest_clinical_knowledge", TOOL_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Cannot load spec from {TOOL_PATH}")
ingest_mod = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = ingest_mod
spec.loader.exec_module(ingest_mod)


def run_cli(*args: str, input_text: str | None = None) -> subprocess.CompletedProcess[str]:
    """Execute the CLI as a subprocess and return completed process."""
    cmd = [sys.executable, str(TOOL_PATH), *args]
    return subprocess.run(
        cmd,
        input=input_text,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
    )


# =============================================================================
# 1. Stress Test: Corrupted JSON Input
# =============================================================================
class TestCorruptedJsonInputStress(unittest.TestCase):
    """Stress-test CLI response to malformed, truncated, empty, and invalid JSON."""

    def test_syntax_error_unclosed_object(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            bad_json = Path(tmp_dir) / "bad_syntax.json"
            bad_json.write_text('{"source_type": "specialty", "source_id": "tim-mach"', encoding="utf-8")

            proc = run_cli("--input-file", str(bad_json), "--dry-run")
            self.assertNotEqual(0, proc.returncode, "CLI must exit non-zero for unclosed JSON")
            self.assertIn("fatal error", (proc.stderr + proc.stdout).lower())

    def test_syntax_error_trailing_comma(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            bad_json = Path(tmp_dir) / "bad_comma.json"
            bad_json.write_text('[{"source_type": "faq", "source_id": "f1", "title": "T", "content": "C"},]', encoding="utf-8")

            proc = run_cli("--input-file", str(bad_json), "--dry-run")
            self.assertNotEqual(0, proc.returncode, "CLI must exit non-zero on trailing comma in standard JSON")

    def test_truncated_json_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            truncated = Path(tmp_dir) / "truncated.json"
            full_content = json.dumps([{"source_type": "specialty", "source_id": "tim-mach", "title": "Tim mach", "content": "Noi dung"}])
            truncated.write_text(full_content[:len(full_content) // 2], encoding="utf-8")

            proc = run_cli("--input-file", str(truncated), "--dry-run")
            self.assertNotEqual(0, proc.returncode, "CLI must exit non-zero on truncated JSON")
            self.assertTrue(len(proc.stderr.strip()) > 0 or "error" in proc.stdout.lower())

    def test_empty_json_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            empty_file = Path(tmp_dir) / "empty.json"
            empty_file.write_text("", encoding="utf-8")

            proc = run_cli("--input-file", str(empty_file), "--dry-run")
            self.assertNotEqual(0, proc.returncode, "CLI must exit non-zero on 0-byte file")

    def test_whitespace_only_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            ws_file = Path(tmp_dir) / "whitespace.json"
            ws_file.write_text("   \n\t  \r\n  ", encoding="utf-8")

            proc = run_cli("--input-file", str(ws_file), "--dry-run")
            self.assertNotEqual(0, proc.returncode, "CLI must exit non-zero on whitespace-only file")

    def test_non_json_binary_garbage(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            bin_file = Path(tmp_dir) / "garbage.json"
            bin_file.write_bytes(b"\x00\xff\xfe\x12\x34\x56\x78\x9a\xbc\xde")

            proc = run_cli("--input-file", str(bin_file), "--dry-run")
            self.assertNotEqual(0, proc.returncode, "CLI must exit non-zero on binary file")

    def test_scalar_json_root_int(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            scalar_file = Path(tmp_dir) / "scalar_int.json"
            scalar_file.write_text("42", encoding="utf-8")

            proc = run_cli("--input-file", str(scalar_file), "--dry-run")
            self.assertNotEqual(0, proc.returncode, "CLI must exit non-zero when JSON root is int")
            self.assertIn("expected list or dict", (proc.stderr + proc.stdout).lower())

    def test_scalar_json_root_string(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            scalar_file = Path(tmp_dir) / "scalar_str.json"
            scalar_file.write_text('"just a string"', encoding="utf-8")

            proc = run_cli("--input-file", str(scalar_file), "--dry-run")
            self.assertNotEqual(0, proc.returncode, "CLI must exit non-zero when JSON root is string")

    def test_array_of_primitives_instead_of_objects(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            prim_file = Path(tmp_dir) / "primitives.json"
            prim_file.write_text(json.dumps([1, 2, 3, "string", True]), encoding="utf-8")

            proc = run_cli("--input-file", str(prim_file), "--dry-run")
            self.assertNotEqual(0, proc.returncode, "CLI must exit non-zero when documents are primitives")

    def test_empty_array_root(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            empty_arr = Path(tmp_dir) / "empty_arr.json"
            empty_arr.write_text("[]", encoding="utf-8")

            proc = run_cli("--input-file", str(empty_arr), "--dry-run")
            self.assertNotEqual(0, proc.returncode, "CLI must exit non-zero when document list is empty")
            self.assertIn("no clinical documents found", (proc.stderr + proc.stdout).lower())

    def test_empty_documents_dict(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            empty_doc = Path(tmp_dir) / "empty_doc.json"
            empty_doc.write_text('{"documents": []}', encoding="utf-8")

            proc = run_cli("--input-file", str(empty_doc), "--dry-run")
            self.assertNotEqual(0, proc.returncode, "CLI must exit non-zero when documents array is empty")


# =============================================================================
# 2. Stress Test: Missing Mandatory Fields
# =============================================================================
class TestMissingMandatoryFieldsStress(unittest.TestCase):
    """Stress-test validation against missing title, content, source_type, source_id."""

    def _assert_validation_fails(self, doc_data: dict[str, Any], expected_err_pattern: str | None = None) -> None:
        with self.assertRaises(Exception) as ctx:
            ingest_mod.validate_and_normalize_document(doc_data)
        if expected_err_pattern:
            self.assertRegex(str(ctx.exception).lower(), expected_err_pattern.lower())

    def test_missing_title(self) -> None:
        doc = {"source_type": "specialty", "source_id": "tim-mach", "content": "Noi dung"}
        self._assert_validation_fails(doc, "missing title")

    def test_title_is_none(self) -> None:
        doc = {"source_type": "specialty", "source_id": "tim-mach", "title": None, "content": "Noi dung"}
        self._assert_validation_fails(doc, "missing title")

    def test_title_is_empty_string(self) -> None:
        doc = {"source_type": "specialty", "source_id": "tim-mach", "title": "", "content": "Noi dung"}
        self._assert_validation_fails(doc, "missing title")

    def test_title_is_whitespace_only(self) -> None:
        doc = {"source_type": "specialty", "source_id": "tim-mach", "title": "   \t\n  ", "content": "Noi dung"}
        self._assert_validation_fails(doc, "missing title")

    def test_missing_content(self) -> None:
        doc = {"source_type": "specialty", "source_id": "tim-mach", "title": "Tim mach"}
        self._assert_validation_fails(doc, "content length")

    def test_content_is_none(self) -> None:
        doc = {"source_type": "specialty", "source_id": "tim-mach", "title": "Tim mach", "content": None}
        self._assert_validation_fails(doc, "content length")

    def test_content_is_empty_string(self) -> None:
        doc = {"source_type": "specialty", "source_id": "tim-mach", "title": "Tim mach", "content": ""}
        self._assert_validation_fails(doc, "content length")

    def test_content_is_whitespace_only(self) -> None:
        doc = {"source_type": "specialty", "source_id": "tim-mach", "title": "Tim mach", "content": "   \n  \t  "}
        self._assert_validation_fails(doc, "content length")

    def test_content_is_pure_html_stripped_to_empty(self) -> None:
        doc = {"source_type": "specialty", "source_id": "tim-mach", "title": "Tim mach", "content": "<script>alert('xss')</script><style>body{}</style>"}
        self._assert_validation_fails(doc, "content length")

    def test_missing_source_type(self) -> None:
        doc = {"source_id": "tim-mach", "title": "Tim mach", "content": "Noi dung"}
        self._assert_validation_fails(doc, "invalid source_type")

    def test_source_type_is_none(self) -> None:
        doc = {"source_type": None, "source_id": "tim-mach", "title": "Tim mach", "content": "Noi dung"}
        self._assert_validation_fails(doc, "invalid source_type")

    def test_source_type_is_empty_string(self) -> None:
        doc = {"source_type": "", "source_id": "tim-mach", "title": "Tim mach", "content": "Noi dung"}
        self._assert_validation_fails(doc, "invalid source_type")

    def test_missing_source_id(self) -> None:
        doc = {"source_type": "specialty", "title": "Tim mach", "content": "Noi dung"}
        self._assert_validation_fails(doc, "source_id")

    def test_source_id_is_none(self) -> None:
        doc = {"source_type": "specialty", "source_id": None, "title": "Tim mach", "content": "Noi dung"}
        self._assert_validation_fails(doc, "source_id")

    def test_source_id_is_empty_string(self) -> None:
        doc = {"source_type": "specialty", "source_id": "", "title": "Tim mach", "content": "Noi dung"}
        self._assert_validation_fails(doc, "source_id")

    def test_completely_empty_document_object(self) -> None:
        self._assert_validation_fails({})

    def test_cli_catches_invalid_doc_in_batch(self) -> None:
        batch = [
            {"source_type": "specialty", "source_id": "doc-1", "title": "T1", "content": "C1"},
            {"source_type": "specialty", "source_id": "doc-2", "title": "T2", "content": "C2"},
            {"source_type": "specialty", "source_id": "doc-3", "content": "C3"},
        ]
        with tempfile.TemporaryDirectory() as tmp_dir:
            batch_file = Path(tmp_dir) / "batch.json"
            batch_file.write_text(json.dumps(batch), encoding="utf-8")

            proc = run_cli("--input-file", str(batch_file), "--dry-run")
            self.assertEqual(1, proc.returncode)
            self.assertIn("Error validating document #3", proc.stderr)


# =============================================================================
# 3. Stress Test: Content Length Bounds (1 to 20,000 characters)
# =============================================================================
class TestContentLengthBoundsStress(unittest.TestCase):
    """Stress-test boundary and out-of-range content length (> 20,000 chars, 0 chars)."""

    def test_content_length_zero_fails(self) -> None:
        doc = {"source_type": "faq", "source_id": "faq-1", "title": "Title", "content": ""}
        with self.assertRaises(ValueError) as ctx:
            ingest_mod.validate_and_normalize_document(doc)
        self.assertIn("outside [1, 20000]", str(ctx.exception))

    def test_content_length_one_char_boundary_succeeds(self) -> None:
        doc = {"source_type": "faq", "source_id": "faq-1", "title": "Title", "content": "A"}
        cdoc = ingest_mod.validate_and_normalize_document(doc)
        self.assertEqual(1, len(cdoc.content))

    def test_content_length_exact_20000_chars_boundary_succeeds(self) -> None:
        content_20k = "A" * 20000
        doc = {"source_type": "faq", "source_id": "faq-1", "title": "Title", "content": content_20k}
        cdoc = ingest_mod.validate_and_normalize_document(doc)
        self.assertEqual(20000, len(cdoc.content))

    def test_content_length_20001_chars_boundary_fails(self) -> None:
        content_20001 = "A" * 20001
        doc = {"source_type": "faq", "source_id": "faq-1", "title": "Title", "content": content_20001}
        with self.assertRaises(ValueError) as ctx:
            ingest_mod.validate_and_normalize_document(doc)
        self.assertIn("outside [1, 20000]", str(ctx.exception))

    def test_content_length_massive_overflow_fails(self) -> None:
        content_100k = "Bệnh án tim mạch chuyên sâu " * 5000
        doc = {"source_type": "article", "source_id": "art-massive", "title": "Title", "content": content_100k}
        with self.assertRaises(ValueError) as ctx:
            ingest_mod.validate_and_normalize_document(doc)
        self.assertIn("outside [1, 20000]", str(ctx.exception))

    def test_cli_exits_nonzero_on_content_overflow(self) -> None:
        record = [{"source_type": "article", "source_id": "art-overflow", "title": "Title", "content": "X" * 25000}]
        with tempfile.TemporaryDirectory() as tmp_dir:
            file_path = Path(tmp_dir) / "overflow.json"
            file_path.write_text(json.dumps(record), encoding="utf-8")

            proc = run_cli("--input-file", str(file_path), "--dry-run")
            self.assertEqual(1, proc.returncode)
            self.assertIn("outside [1, 20000]", proc.stderr)


# =============================================================================
# 4. Stress Test: Invalid source_type
# =============================================================================
class TestInvalidSourceTypeStress(unittest.TestCase):
    """Stress-test invalid medical or arbitrary source_types against ALLOWED_SOURCE_TYPES."""

    INVALID_SOURCE_TYPES = [
        "hospital",
        "prescription",
        "medicine",
        "department",
        "clinic",
        "nurse",
        "treatment",
        "appointment",
        "diagnostic",
        "examination",
        "12345",
        "specialty_invalid",
        "faq-item",
    ]

    def test_invalid_source_types_rejected_by_validator(self) -> None:
        for stype in self.INVALID_SOURCE_TYPES:
            with self.subTest(source_type=stype):
                doc = {"source_type": stype, "source_id": "valid-id", "title": "Title", "content": "Content"}
                with self.assertRaises(ValueError) as ctx:
                    ingest_mod.validate_and_normalize_document(doc)
                self.assertIn("invalid source_type", str(ctx.exception).lower())

    def test_all_canonical_source_types_accepted(self) -> None:
        allowed = ["specialty", "doctor", "branch", "service", "package", "article", "faq"]
        for stype in allowed:
            with self.subTest(source_type=stype):
                doc = {"source_type": stype, "source_id": f"{stype}-id-1", "title": f"Title {stype}", "content": "Content valid"}
                cdoc = ingest_mod.validate_and_normalize_document(doc)
                self.assertEqual(stype, cdoc.source_type)

    def test_cli_exits_nonzero_on_invalid_source_type(self) -> None:
        record = [{"source_type": "hospital", "source_id": "bv-cho-ray", "title": "Benh vien Cho Ray", "content": "Dia chi Q5"}]
        with tempfile.TemporaryDirectory() as tmp_dir:
            file_path = Path(tmp_dir) / "bad_stype.json"
            file_path.write_text(json.dumps(record), encoding="utf-8")

            proc = run_cli("--input-file", str(file_path), "--dry-run")
            self.assertEqual(1, proc.returncode)
            self.assertIn("Invalid source_type 'hospital'", proc.stderr)


# =============================================================================
# 5. Stress Test: Invalid source_id Characters and Lengths
# =============================================================================
class TestInvalidSourceIdCharactersStress(unittest.TestCase):
    """Stress-test source_id constraints (pattern ^[A-Za-z0-9._:-]+$, length 1-200)."""

    INVALID_IDS = [
        ("tim mach", "contains spaces"),
        ("co so 1", "internal spaces"),
        ("faq item 1", "internal multiple spaces"),
        ("specialty/tim-mach", "forward slash"),
        ("branch\\co-so-1", "backward slash"),
        ("tim-mạch", "vietnamese diacritics"),
        ("cơ-sở-1", "vietnamese characters"),
        ("doctor@hospital", "at symbol @"),
        ("faq#1", "hash symbol #"),
        ("article?query=1", "question mark ?"),
        ("art!cle", "exclamation mark !"),
        ("item$price", "dollar sign $"),
        ("doc&nurse", "ampersand &"),
        ("item*star", "asterisk *"),
        ("cardio💖heart", "unicode emoji"),
        ("null\x00byte", "null byte"),
        ("id" * 101, "exceeds 200 characters (202 chars)"),
    ]

    def test_invalid_source_ids_rejected_by_validator(self) -> None:
        for bad_id, reason in self.INVALID_IDS:
            with self.subTest(source_id=bad_id, reason=reason):
                doc = {"source_type": "specialty", "source_id": bad_id, "title": "Title", "content": "Content"}
                with self.assertRaises(ValueError) as ctx:
                    ingest_mod.validate_and_normalize_document(doc)
                self.assertTrue(
                    "does not match pattern" in str(ctx.exception) or "outside [1, 200]" in str(ctx.exception),
                    f"Unexpected error message for {bad_id}: {ctx.exception}",
                )

    def test_source_id_surrounding_whitespace_sanitized_to_valid_slug(self) -> None:
        """Surrounding whitespace is stripped to valid slug, while whitespace-only fails."""
        doc_leading = {"source_type": "specialty", "source_id": "  co-so-1", "title": "Title", "content": "Content"}
        cdoc = ingest_mod.validate_and_normalize_document(doc_leading)
        self.assertEqual("co-so-1", cdoc.source_id)

        doc_trailing = {"source_type": "specialty", "source_id": "co-so-1  ", "title": "Title", "content": "Content"}
        cdoc = ingest_mod.validate_and_normalize_document(doc_trailing)
        self.assertEqual("co-so-1", cdoc.source_id)

        doc_ws_only = {"source_type": "specialty", "source_id": "   ", "title": "Title", "content": "Content"}
        with self.assertRaises(ValueError):
            ingest_mod.validate_and_normalize_document(doc_ws_only)

    def test_valid_source_id_characters_and_bounds(self) -> None:
        valid_ids = [
            "a",
            "Z",
            "9",
            "tim-mach",
            "co_so_1",
            "guide.cardiology",
            "faq:bhyt:01",
            "ABC-123.xyz_456:789",
            "x" * 200,
        ]
        for vid in valid_ids:
            with self.subTest(source_id=vid[:30]):
                doc = {"source_type": "specialty", "source_id": vid, "title": "Title", "content": "Content"}
                cdoc = ingest_mod.validate_and_normalize_document(doc)
                self.assertEqual(vid, cdoc.source_id)

    def test_cli_exits_nonzero_on_invalid_source_id(self) -> None:
        record = [{"source_type": "specialty", "source_id": "tim mach khoa", "title": "Title", "content": "Content"}]
        with tempfile.TemporaryDirectory() as tmp_dir:
            file_path = Path(tmp_dir) / "bad_id.json"
            file_path.write_text(json.dumps(record), encoding="utf-8")

            proc = run_cli("--input-file", str(file_path), "--dry-run")
            self.assertEqual(1, proc.returncode)
            self.assertIn("does not match pattern", proc.stderr)


# =============================================================================
# 6. Stress Test: Duplicate Records & In-Memory Deduplication
# =============================================================================
class TestDuplicateRecordDeduplicationStress(unittest.TestCase):
    """Stress-test in-memory deduplication on (source_type, source_id)."""

    def test_duplicate_records_in_memory_deduplication(self) -> None:
        records = [
            {"source_type": "specialty", "source_id": "tim-mach", "title": "Tim Mach 1", "content": "Content 1"},
            {"source_type": "specialty", "source_id": "tim-mach", "title": "Tim Mach 2 Updated", "content": "Content 2 Updated"},
        ]
        with tempfile.TemporaryDirectory() as tmp_dir:
            file_path = Path(tmp_dir) / "dup.json"
            file_path.write_text(json.dumps(records), encoding="utf-8")
            sql_out = Path(tmp_dir) / "out.sql"

            proc = run_cli("--input-file", str(file_path), "--output-sql", str(sql_out))
            self.assertEqual(0, proc.returncode, f"CLI must succeed when deduplicating. Stderr: {proc.stderr}")
            stdout = proc.stdout
            self.assertIn("Total Unique Documents: 1", stdout)
            self.assertIn("Notice: Duplicate key ('specialty', 'tim-mach') overwritten", stdout)

            # Verify that generated SQL has exactly 1 INSERT statement for specialty:tim-mach with the UPDATED content
            sql_text = sql_out.read_text(encoding="utf-8")
            insert_matches = re.findall(r"INSERT INTO healthcare\.ai_documents", sql_text)
            self.assertEqual(1, len(insert_matches), "Deduplication must result in exactly 1 INSERT in SQL script")
            self.assertIn("Tim Mach 2 Updated", sql_text)
            self.assertNotIn("Tim Mach 1", sql_text)

    def test_duplicate_large_batch_stress(self) -> None:
        """100 records collapsing into 10 unique documents."""
        records = []
        for cycle in range(10):
            for i in range(10):
                records.append({
                    "source_type": "article",
                    "source_id": f"article-{i}",
                    "title": f"Article {i} version {cycle}",
                    "content": f"Content for article {i} at revision {cycle}",
                })
        self.assertEqual(100, len(records))

        with tempfile.TemporaryDirectory() as tmp_dir:
            file_path = Path(tmp_dir) / "dup_batch.json"
            file_path.write_text(json.dumps(records), encoding="utf-8")

            proc = run_cli("--input-file", str(file_path), "--dry-run")
            self.assertEqual(0, proc.returncode)
            self.assertIn("Total Unique Documents: 10", proc.stdout)

    def test_same_source_id_different_source_type_is_not_duplicate(self) -> None:
        records = [
            {"source_type": "specialty", "source_id": "tim-mach", "title": "Chuyen khoa Tim", "content": "Content spec"},
            {"source_type": "article", "source_id": "tim-mach", "title": "Bai viet Tim", "content": "Content art"},
        ]
        with tempfile.TemporaryDirectory() as tmp_dir:
            file_path = Path(tmp_dir) / "cross_type.json"
            file_path.write_text(json.dumps(records), encoding="utf-8")

            proc = run_cli("--input-file", str(file_path), "--dry-run")
            self.assertEqual(0, proc.returncode)
            self.assertIn("Total Unique Documents: 2", proc.stdout)


# =============================================================================
# 7. Stress Test: Graceful Exit Codes, Error Reporting & SQL Generation
# =============================================================================
class TestCliGracefulExitCodesAndOracles(unittest.TestCase):
    """Verify CLI exits 0 on valid inputs, non-zero on errors, and generates valid SQL."""

    def test_cli_exits_zero_on_dry_run_default_dataset(self) -> None:
        proc = run_cli("--dry-run")
        self.assertEqual(0, proc.returncode)
        self.assertIn("[DRY-RUN SUCCESS]", proc.stdout)

    def test_cli_exits_one_on_nonexistent_input_file(self) -> None:
        proc = run_cli("--input-file", "does_not_exist_987654321.json")
        self.assertEqual(1, proc.returncode)
        self.assertIn("Input JSON file not found", proc.stderr)

    def test_cli_exits_one_on_nonexistent_markdown_dir(self) -> None:
        proc = run_cli("--input-dir", "does_not_exist_markdown_dir_xyz")
        self.assertEqual(1, proc.returncode)
        self.assertIn("Input markdown directory not found", proc.stderr)

    def test_cli_exits_one_on_invalid_dimension(self) -> None:
        proc = run_cli("--dimension", "1536", "--dry-run")
        self.assertEqual(1, proc.returncode)
        self.assertIn("embedding_dimension = 384", proc.stderr + proc.stdout)

    def test_sql_output_generation_integrity(self) -> None:
        sample = [
            {"source_type": "specialty", "source_id": "tim-mach", "title": "Khoa Tim Mạch", "content": "Khám bệnh tim mạch."},
            {"source_type": "branch", "source_id": "co-so-1", "title": "Cơ sở 1", "content": "123 Đường Số 1."},
        ]
        with tempfile.TemporaryDirectory() as tmp_dir:
            in_file = Path(tmp_dir) / "in.json"
            in_file.write_text(json.dumps(sample), encoding="utf-8")
            out_sql = Path(tmp_dir) / "generated.sql"

            proc = run_cli("--input-file", str(in_file), "--output-sql", str(out_sql))
            self.assertEqual(0, proc.returncode)
            self.assertTrue(out_sql.exists())

            content = out_sql.read_text(encoding="utf-8")
            self.assertTrue(content.startswith("-- ===="))
            self.assertIn("BEGIN;", content)
            self.assertIn("COMMIT;", content)
            self.assertIn("healthcare.ai_documents", content)
            self.assertIn("ON CONFLICT (source_type, source_id) DO UPDATE SET", content)
            self.assertIn("tim-mach", content)
            self.assertIn("co-so-1", content)


# =============================================================================
# 8. Property-Based Fuzzing with Hypothesis
# =============================================================================
class TestHypothesisPropertyBasedFuzzing(unittest.TestCase):
    """Property-based stress-testing of document normalization and validation rules."""

    @settings(max_examples=50, deadline=None)
    @given(st.text(min_size=1, max_size=100))
    def test_fuzz_arbitrary_source_id_conformance(self, raw_id: str) -> None:
        """If source_id matches ^[A-Za-z0-9._:-]+$ and len <= 200, validator accepts; else raises ValueError."""
        doc = {
            "source_type": "specialty",
            "source_id": raw_id,
            "title": "Valid Title",
            "content": "Valid Content",
        }
        is_pattern_valid = bool(re.fullmatch(r"^[A-Za-z0-9._:-]+$", raw_id))
        is_length_valid = 1 <= len(raw_id) <= 200

        if is_pattern_valid and is_length_valid:
            cdoc = ingest_mod.validate_and_normalize_document(doc)
            self.assertEqual(raw_id, cdoc.source_id)
        else:
            with self.assertRaises(ValueError):
                ingest_mod.validate_and_normalize_document(doc)

    @settings(max_examples=50, deadline=None)
    @given(st.text(alphabet=st.characters(blacklist_categories=('Cs',)), min_size=0, max_size=50))
    def test_fuzz_arbitrary_source_type_conformance(self, raw_type: str) -> None:
        """Only elements in ALLOWED_SOURCE_TYPES are permitted; all others must fail."""
        doc = {
            "source_type": raw_type,
            "source_id": "valid-id",
            "title": "Valid Title",
            "content": "Valid Content",
        }
        normalized_type = raw_type.strip().lower()
        if normalized_type in ingest_mod.ALLOWED_SOURCE_TYPES:
            cdoc = ingest_mod.validate_and_normalize_document(doc)
            self.assertEqual(normalized_type, cdoc.source_type)
        else:
            with self.assertRaises(ValueError):
                ingest_mod.validate_and_normalize_document(doc)

    @settings(max_examples=30, deadline=None)
    @given(st.integers(min_value=0, max_value=25000))
    def test_fuzz_content_length_partition(self, length: int) -> None:
        """Content length strictly partitions at [1, 20000]."""
        content = "x" * length
        doc = {
            "source_type": "faq",
            "source_id": "valid-faq",
            "title": "Valid Title",
            "content": content,
        }
        if 1 <= length <= 20000:
            cdoc = ingest_mod.validate_and_normalize_document(doc)
            self.assertEqual(length, len(cdoc.content))
        else:
            with self.assertRaises(ValueError):
                ingest_mod.validate_and_normalize_document(doc)


if __name__ == "__main__":
    unittest.main(verbosity=2)
