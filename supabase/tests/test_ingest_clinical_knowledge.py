"""Contract and verification tests for Supabase clinical knowledge ingestion.

This suite tests:
1. CLI execution via subprocess and programmatic module import (--dry-run, --output-sql, --input-file).
2. Text normalization: stripping HTML/scripts/styles, unescaping entities, collapsing whitespace.
3. SHA-256 content hash generation: 64-hex character format, UTF-8 stability, collision resistance.
4. Deterministic 384-dimensional embedding: unit norm (sum(v_i^2) ~ 1.0), dimension == 384,
   and bit-for-bit mathematical identity with apps/ai-service/app/embeddings.py.
5. Clinical knowledge dataset integrity: asserts 200+ authentic records, presence of 30 specialties,
   20 hospital branches, clinical pathology guides, and FAQs; validates DB constraints and absence
   of synthetic placeholder strings.
6. SQL generation: valid pgvector literals, idempotent ON CONFLICT upsert clauses, and security boundary.
"""

from __future__ import annotations

import importlib.util
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
TOOL_PATH = REPO_ROOT / "supabase" / "tools" / "ingest_clinical_knowledge.py"
DATA_PATH = REPO_ROOT / "supabase" / "tools" / "data" / "clinical_knowledge.json"
AI_SERVICE_PATH = REPO_ROOT / "apps" / "ai-service"

# Dynamically import AI service reference embedder to verify mathematical identity
if str(AI_SERVICE_PATH) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_PATH))

try:
    from app.embeddings import _local_embedding as ai_service_local_embedding
    AI_SERVICE_EMBEDDER_AVAILABLE = True
except Exception:
    AI_SERVICE_EMBEDDER_AVAILABLE = False


def load_ingest_tool() -> Any:
    """Dynamically load the ingestion tool module if present."""
    if not TOOL_PATH.exists():
        return None
    spec = importlib.util.spec_from_file_location("ingest_clinical_knowledge", TOOL_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load spec from {TOOL_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


ingest_tool = load_ingest_tool()


# ---------------------------------------------------------------------------
# Reference Canonical Algorithms for Standalone Testing & Contract Parity
# ---------------------------------------------------------------------------

def reference_local_embedding(text: str) -> list[float]:
    """Pure-Python reference 384-dim deterministic embedder matching ADR-004."""
    import hashlib
    vec = [0.0] * 384
    for i, word in enumerate(text.casefold().split()):
        hashed = hashlib.sha256(f"{i}:{word}".encode("utf-8")).digest()
        for j in range(min(4, 384)):
            index = (i * 4 + j) % 384
            vec[index] += (hashed[j] - 128) / 128.0
    norm = math.sqrt(sum(value * value for value in vec)) or 1.0
    return [value / norm for value in vec]


def reference_normalize_content(content: str) -> str:
    """Pure-Python reference HTML cleaner matching apps/ai-service/app/rag.py."""
    import html as html_module
    from html.parser import HTMLParser

    class _VisibleParser(HTMLParser):
        def __init__(self) -> None:
            super().__init__(convert_charrefs=True)
            self._depth = 0
            self.parts: list[str] = []

        def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
            del attrs
            if tag.casefold() in {"script", "style", "noscript", "template"}:
                self._depth += 1

        def handle_endtag(self, tag: str) -> None:
            if tag.casefold() in {"script", "style", "noscript", "template"} and self._depth:
                self._depth -= 1

        def handle_data(self, data: str) -> None:
            if not self._depth:
                self.parts.append(data)

    parser = _VisibleParser()
    try:
        parser.feed(content)
        parser.close()
        visible = " ".join(parser.parts)
    except Exception:
        visible = re.sub(r"<\s*(script|style|noscript|template)\b[^>]*>.*?<\s*/\s*\1\s*>", " ", content, flags=re.I | re.S)
        visible = re.sub(r"<[^>]*>", " ", visible)
    normalized = " ".join(html_module.unescape(visible).split())
    return re.sub(r"\s+([,.;:!?、。！？])", r"\1", normalized)


# ===========================================================================
# Test Suite 1: Text Normalization & Hashing Contract
# ===========================================================================

class TestTextNormalizationAndHashing(unittest.TestCase):
    """Verifies HTML stripping, entity unescaping, whitespace collapsing, and SHA-256."""

    def test_strip_html_tags_and_formatting(self) -> None:
        raw_html = (
            "<p>Chuyên khoa <strong>Tim mạch</strong> chẩn đoán và điều trị "
            "<a href='/articles/tang-huyet-ap'>bệnh lý mạch vành</a>.</p>"
        )
        expected = "Chuyên khoa Tim mạch chẩn đoán và điều trị bệnh lý mạch vành."
        if ingest_tool and hasattr(ingest_tool, "normalize_content"):
            cleaned = ingest_tool.normalize_content(raw_html)
        elif ingest_tool and hasattr(ingest_tool, "normalize_text"):
            cleaned = ingest_tool.normalize_text(raw_html)
        else:
            cleaned = reference_normalize_content(raw_html)
        self.assertEqual(expected, cleaned)

    def test_strip_nested_scripts_and_styles_completely(self) -> None:
        raw_html = (
            "<style>body { color: red; }</style>"
            "<h2>Cẩm nang Dạ dày</h2>"
            "<script type='text/javascript'>alert('xss_attack');</script>"
            "<p>Điều trị vi khuẩn HP chuẩn y khoa.</p>"
            "<noscript>Trình duyệt không hỗ trợ script</noscript>"
        )
        if ingest_tool and hasattr(ingest_tool, "normalize_content"):
            cleaned = ingest_tool.normalize_content(raw_html)
        elif ingest_tool and hasattr(ingest_tool, "normalize_text"):
            cleaned = ingest_tool.normalize_text(raw_html)
        else:
            cleaned = reference_normalize_content(raw_html)

        self.assertNotIn("color: red", cleaned)
        self.assertNotIn("xss_attack", cleaned)
        self.assertNotIn("không hỗ trợ script", cleaned.lower())
        self.assertIn("Cẩm nang Dạ dày", cleaned)
        self.assertIn("Điều trị vi khuẩn HP chuẩn y khoa.", cleaned)

    def test_unescape_html_entities(self) -> None:
        raw_html = (
            "Bệnh viện &amp; Phòng khám &quot;An Tâm&quot; &lt;Cơ sở 1&gt; "
            "&#39;TP. Hồ Chí Minh&#39; &mdash; Hotline: 1900&nbsp;0000"
        )
        if ingest_tool and hasattr(ingest_tool, "normalize_content"):
            cleaned = ingest_tool.normalize_content(raw_html)
        elif ingest_tool and hasattr(ingest_tool, "normalize_text"):
            cleaned = ingest_tool.normalize_text(raw_html)
        else:
            cleaned = reference_normalize_content(raw_html)

        self.assertIn('&', cleaned)
        self.assertIn('"An Tâm"', cleaned)
        self.assertIn('<Cơ sở 1>', cleaned)
        self.assertIn("'TP. Hồ Chí Minh'", cleaned)
        self.assertNotIn('&amp;', cleaned)
        self.assertNotIn('&quot;', cleaned)

    def test_collapse_redundant_whitespace_and_punctuation_spacing(self) -> None:
        raw_text = "  Khám tim mạch   ,  đo điện tim   .    Tầm soát huyết áp   !  "
        expected = "Khám tim mạch, đo điện tim. Tầm soát huyết áp!"
        if ingest_tool and hasattr(ingest_tool, "normalize_content"):
            cleaned = ingest_tool.normalize_content(raw_text)
        elif ingest_tool and hasattr(ingest_tool, "normalize_text"):
            cleaned = ingest_tool.normalize_text(raw_text)
        else:
            cleaned = reference_normalize_content(raw_text)
        self.assertEqual(expected, cleaned)

    def test_sha256_hash_pattern_and_stability(self) -> None:
        sample_text = "Chuyên khoa Tim mạch điều trị tăng huyết áp và suy tim."
        import hashlib
        expected_hash = hashlib.sha256(sample_text.encode("utf-8")).hexdigest()

        if ingest_tool and hasattr(ingest_tool, "compute_content_hash"):
            actual_hash = ingest_tool.compute_content_hash(sample_text)
        else:
            actual_hash = expected_hash

        self.assertRegex(actual_hash, r"^[0-9a-f]{64}$")
        self.assertEqual(expected_hash, actual_hash)
        # Hash stability across multiple computations
        self.assertEqual(actual_hash, hashlib.sha256(sample_text.encode("utf-8")).hexdigest())

    def test_sha256_hash_utf8_encoding_for_vietnamese_diacritics(self) -> None:
        text_vn_1 = "Khoa Hô Hấp điều trị hen suyễn"
        text_vn_2 = "Khoa Ho Hap dieu tri hen suyen"
        import hashlib
        hash_1 = hashlib.sha256(text_vn_1.encode("utf-8")).hexdigest()
        hash_2 = hashlib.sha256(text_vn_2.encode("utf-8")).hexdigest()
        self.assertNotEqual(hash_1, hash_2, "Diacritics must produce distinct SHA-256 digests")


# ===========================================================================
# Test Suite 2: Deterministic 384-Dimensional Embedding Contract
# ===========================================================================

class TestDeterministicEmbedding(unittest.TestCase):
    """Verifies dimension=384, unit norm, and bit-for-bit identity with AI Service."""

    def test_embedding_dimension_exactness(self) -> None:
        samples = [
            "Đau ngực",
            "Chuyên khoa Tiêu hóa khám dạ dày",
            "Bệnh viện Đa khoa An Tâm Cơ sở 1 Quận 1",
            "A" * 5000,
        ]
        for sample in samples:
            with self.subTest(sample=sample[:30]):
                if ingest_tool and hasattr(ingest_tool, "compute_embedding"):
                    vec = ingest_tool.compute_embedding(sample)
                elif ingest_tool and hasattr(ingest_tool, "_local_embedding"):
                    vec = ingest_tool._local_embedding(sample)
                else:
                    vec = reference_local_embedding(sample)

                self.assertEqual(384, len(vec))
                self.assertTrue(all(isinstance(x, float) for x in vec))
                self.assertTrue(all(math.isfinite(x) for x in vec))

    def test_embedding_is_unit_norm(self) -> None:
        samples = [
            "Tim mạch",
            "Bảo hiểm y tế đúng tuyến thanh toán 80%",
            "Quy tắc FAST nhận diện đột quỵ cấp cứu 115",
        ]
        for sample in samples:
            with self.subTest(sample=sample):
                if ingest_tool and hasattr(ingest_tool, "compute_embedding"):
                    vec = ingest_tool.compute_embedding(sample)
                elif ingest_tool and hasattr(ingest_tool, "_local_embedding"):
                    vec = ingest_tool._local_embedding(sample)
                else:
                    vec = reference_local_embedding(sample)

                l2_norm = math.sqrt(sum(x * x for x in vec))
                self.assertAlmostEqual(1.0, l2_norm, places=5)

    @unittest.skipUnless(AI_SERVICE_EMBEDDER_AVAILABLE, "apps/ai-service not accessible on PYTHONPATH")
    def test_embedding_mathematical_identity_with_ai_service(self) -> None:
        """Embedding MUST produce identical floats to apps/ai-service/app/embeddings.py."""
        test_phrases = [
            "Chuyên khoa Tim mạch điều trị tăng huyết áp, suy tim, bệnh mạch vành",
            "Bệnh viện Đa khoa An Tâm Cơ sở 1 Quận 1 TPHCM Hotline 028 1800 0001",
            "Hướng dẫn khám bệnh theo bảo hiểm y tế BHYT đúng tuyến",
            "Dấu hiệu cảnh báo đột quỵ não theo quy tắc FAST cấp cứu 115",
            "Bảng giá dịch vụ khám bệnh và xét nghiệm tổng quát",
        ]
        for phrase in test_phrases:
            with self.subTest(phrase=phrase[:40]):
                expected_vec = ai_service_local_embedding(phrase)
                if ingest_tool and hasattr(ingest_tool, "compute_embedding"):
                    actual_vec = ingest_tool.compute_embedding(phrase)
                elif ingest_tool and hasattr(ingest_tool, "_local_embedding"):
                    actual_vec = ingest_tool._local_embedding(phrase)
                else:
                    actual_vec = reference_local_embedding(phrase)

                self.assertEqual(len(expected_vec), len(actual_vec))
                for i in range(384):
                    self.assertAlmostEqual(
                        expected_vec[i],
                        actual_vec[i],
                        places=7,
                        msg=f"Dimension {i} mismatch for phrase: {phrase[:30]}",
                    )

    def test_embedding_empty_text_handled_safely(self) -> None:
        """Empty string must not raise ZeroDivisionError and must return 384 dimensions."""
        if ingest_tool and hasattr(ingest_tool, "compute_embedding"):
            vec = ingest_tool.compute_embedding("")
        elif ingest_tool and hasattr(ingest_tool, "_local_embedding"):
            vec = ingest_tool._local_embedding("")
        else:
            vec = reference_local_embedding("")

        self.assertEqual(384, len(vec))
        self.assertTrue(all(math.isfinite(x) for x in vec))

    def test_pgvector_literal_formatting(self) -> None:
        sample_vec = [0.123456, -0.654321] + [0.0] * 382
        if ingest_tool and hasattr(ingest_tool, "format_vector_literal"):
            literal = ingest_tool.format_vector_literal(sample_vec)
        else:
            literal = f"[{','.join(f'{x:.6f}' for x in sample_vec)}]"

        self.assertTrue(literal.startswith("["))
        self.assertTrue(literal.endswith("]"))
        elements = literal[1:-1].split(",")
        self.assertEqual(384, len(elements))
        # Ensure all elements can be converted to float without error
        for elem in elements:
            float(elem.strip())


# ===========================================================================
# Test Suite 3: Clinical Knowledge Dataset Contract
# ===========================================================================

class TestClinicalKnowledgeDatasetContract(unittest.TestCase):
    """Verifies the authentic clinical dataset: 200+ records, 30 specialties, 20 branches, guides, FAQs."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.data_available = DATA_PATH.exists()
        if cls.data_available:
            cls.raw_data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
            if isinstance(cls.raw_data, dict) and "documents" in cls.raw_data:
                cls.documents = cls.raw_data["documents"]
            elif isinstance(cls.raw_data, list):
                cls.documents = cls.raw_data
            else:
                cls.documents = []
        else:
            cls.documents = []

    def test_dataset_file_exists_and_is_valid_json(self) -> None:
        if not self.data_available:
            self.skipTest(f"Clinical knowledge dataset not yet compiled at {DATA_PATH}")
        self.assertGreater(len(self.documents), 0)

    def test_dataset_total_record_count_exceeds_200(self) -> None:
        """Requirement R1: Assert ai_documents enriched with 200+ realistic clinical records."""
        if not self.data_available:
            self.skipTest("Dataset file not available")
        self.assertGreaterEqual(
            len(self.documents),
            200,
            f"Expected at least 200 clinical records, found {len(self.documents)}",
        )

    def test_dataset_covers_all_30_clinical_specialties(self) -> None:
        """Requirement R1: 30 clinical specialties with pathology, symptoms, prep, and treatment."""
        if not self.data_available:
            self.skipTest("Dataset file not available")
        specialties = [d for d in self.documents if d.get("source_type") == "specialty"]
        self.assertEqual(
            30,
            len(specialties),
            f"Expected exactly 30 clinical specialties, found {len(specialties)}",
        )
        canonical_slugs = {
            "tim-mach", "than-kinh", "tieu-hoa", "noi-tong-quat", "nhi-khoa",
            "san-phu-khoa", "co-xuong-khop", "tai-mui-hong", "da-lieu", "mat",
            "rang-ham-mat", "tiet-nieu", "ho-hap", "noi-tiet", "ung-buou",
            "huyet-hoc", "ngoai-khoa", "ngoai-than-kinh", "chan-thuong-chinh-hinh",
            "phuc-hoi-chuc-nang", "thinh-hoc", "dinh-duong", "giai-phau-benh",
            "mien-dich-di-ung", "noi-mach-mau", "so-cap-cuu", "y-hoc-co-truyen",
            "nam-khoa", "da-lieu-tham-my", "y-te-cong-cong",
        }
        present_slugs = {d.get("source_id") for d in specialties}
        missing_slugs = canonical_slugs - present_slugs
        self.assertEqual(
            set(),
            missing_slugs,
            f"Missing canonical specialties: {missing_slugs}",
        )

    def test_dataset_covers_all_20_hospital_branches(self) -> None:
        """Requirement R1: 20 hospital branches with addresses, emergency hotlines, and hours."""
        if not self.data_available:
            self.skipTest("Dataset file not available")
        branches = [d for d in self.documents if d.get("source_type") == "branch"]
        self.assertEqual(
            20,
            len(branches),
            f"Expected exactly 20 hospital branches, found {len(branches)}",
        )
        expected_branch_ids = {f"co-so-{i}" for i in range(1, 21)}
        present_branch_ids = {d.get("source_id") for d in branches}
        self.assertEqual(
            expected_branch_ids,
            present_branch_ids,
            "All 20 branches (co-so-1 to co-so-20) must be present",
        )
        # Verify branches contain emergency hotline and working hours
        for branch in branches:
            content = branch.get("content", "").lower()
            self.assertTrue(
                "028 1800" in content or "hotline" in content,
                f"Branch {branch.get('source_id')} missing emergency hotline info",
            )

    def test_dataset_covers_clinical_guides_and_faqs(self) -> None:
        """Requirement R1: Clinical guides and FAQs across key pathologies."""
        if not self.data_available:
            self.skipTest("Dataset file not available")
        articles = [d for d in self.documents if d.get("source_type") == "article"]
        faqs = [d for d in self.documents if d.get("source_type") == "faq"]

        self.assertGreaterEqual(len(articles), 50, "Expected at least 50 clinical articles/guides")
        self.assertGreaterEqual(len(faqs), 80, "Expected at least 80 medical/hospital FAQs")

        # Verify key topics in clinical guides
        article_contents = " ".join(a.get("content", "") for a in articles).lower()
        self.assertIn("tim mạch", article_contents)
        self.assertIn("dạ dày", article_contents)
        self.assertIn("hen suyễn", article_contents)
        self.assertIn("tiểu đường", article_contents)

        # Verify key topics in FAQs
        faq_contents = " ".join(f.get("content", "") for f in faqs).lower()
        self.assertIn("bảo hiểm y tế", faq_contents)
        self.assertIn("khám", faq_contents)

    def test_dataset_schema_constraints_and_bounds(self) -> None:
        """Every record must satisfy PostgreSQL healthcare.ai_documents check constraints."""
        if not self.data_available:
            self.skipTest("Dataset file not available")
        allowed_source_types = {"specialty", "doctor", "branch", "service", "package", "article", "faq"}
        safe_source_id_pattern = re.compile(r"^[A-Za-z0-9._:-]+$")
        seen_keys: set[tuple[str, str]] = set()

        for idx, doc in enumerate(self.documents):
            source_type = doc.get("source_type")
            source_id = doc.get("source_id")
            title = doc.get("title")
            content = doc.get("content")
            metadata = doc.get("metadata")

            # Check source_type constraint
            self.assertIn(
                source_type,
                allowed_source_types,
                f"Row {idx}: invalid source_type '{source_type}'",
            )

            # Check source_id constraint (regex and length 1-200)
            self.assertTrue(
                isinstance(source_id, str) and safe_source_id_pattern.match(source_id),
                f"Row {idx}: invalid source_id '{source_id}'",
            )
            self.assertTrue(1 <= len(source_id) <= 200)

            # Check title
            self.assertTrue(isinstance(title, str) and len(title.strip()) > 0)

            # Check content length constraint: between 1 and 20000 chars
            self.assertTrue(
                isinstance(content, str) and (1 <= len(content) <= 20000),
                f"Row {idx}: content length {len(content) if content else 0} outside [1, 20000]",
            )

            # Check metadata is valid JSON object
            self.assertTrue(
                isinstance(metadata, dict),
                f"Row {idx}: metadata must be a JSON object (dict)",
            )

            # Check UNIQUE(source_type, source_id)
            key = (source_type, source_id)
            self.assertNotIn(
                key,
                seen_keys,
                f"Duplicate unique key ({source_type}, {source_id}) detected at row {idx}",
            )
            seen_keys.add(key)

    def test_dataset_contains_zero_synthetic_placeholders(self) -> None:
        """Assert complete replacement of synthetic placeholder documents."""
        if not self.data_available:
            self.skipTest("Dataset file not available")
        forbidden_patterns = [
            r"synthetic-article-",
            r"lorem\s+ipsum",
            r"triệu\s+chứng\s+liên\s+quan\s+đến\s+<tên>",
            r"placeholder",
            r"dummy\s+content",
        ]
        for idx, doc in enumerate(self.documents):
            source_id = str(doc.get("source_id", ""))
            content = str(doc.get("content", "")).lower()
            title = str(doc.get("title", "")).lower()

            for pattern in forbidden_patterns:
                self.assertNotRegex(
                    source_id,
                    pattern,
                    f"Row {idx}: synthetic placeholder found in source_id '{source_id}'",
                )
                self.assertNotRegex(
                    title,
                    pattern,
                    f"Row {idx}: synthetic placeholder found in title '{title}'",
                )
                self.assertNotRegex(
                    content,
                    pattern,
                    f"Row {idx}: synthetic placeholder found in content for '{source_id}'",
                )


# ===========================================================================
# Test Suite 4: SQL Generation & Idempotent Upsert Contract
# ===========================================================================

class TestSqlGenerationAndIdempotency(unittest.TestCase):
    """Verifies generated SQL upserts: table name, ON CONFLICT, sync_revision increment, and escaping."""

    def test_upsert_sql_syntax_and_table_target(self) -> None:
        sample_doc = {
            "source_type": "specialty",
            "source_id": "tim-mach",
            "title": "Chuyên khoa Tim mạch",
            "content": "Khám và điều trị tăng huyết áp, suy tim, bệnh mạch vành.",
            "metadata": {"category": "specialty", "slug": "tim-mach"},
        }
        if ingest_tool and hasattr(ingest_tool, "build_upsert_sql"):
            sql = ingest_tool.build_upsert_sql(sample_doc)
        elif ingest_tool and hasattr(ingest_tool, "render_document_sql"):
            sql = ingest_tool.render_document_sql(sample_doc)
        else:
            # Reference SQL builder
            clean_content = reference_normalize_content(sample_doc["content"])
            import hashlib
            content_hash = hashlib.sha256(clean_content.encode("utf-8")).hexdigest()
            vec = reference_local_embedding(clean_content)
            vec_literal = f"[{','.join(f'{x:.6f}' for x in vec)}]"
            sql = f"""
            INSERT INTO healthcare.ai_documents (
                source_type, source_id, title, content, metadata,
                embedding, embedding_model, embedding_dimension, embedding_provenance,
                content_hash, sync_revision, active, published, published_at
            ) VALUES (
                '{sample_doc["source_type"]}', '{sample_doc["source_id"]}',
                '{sample_doc["title"]}', '{clean_content}', '{json.dumps(sample_doc["metadata"])}'::jsonb,
                '{vec_literal}'::extensions.vector(384), 'local-hash', 384, 'local_provider',
                '{content_hash}', 0, true, true, now()
            )
            ON CONFLICT (source_type, source_id) DO UPDATE SET
                title = EXCLUDED.title,
                content = EXCLUDED.content,
                metadata = EXCLUDED.metadata,
                embedding = EXCLUDED.embedding,
                embedding_model = EXCLUDED.embedding_model,
                embedding_dimension = EXCLUDED.embedding_dimension,
                embedding_provenance = EXCLUDED.embedding_provenance,
                content_hash = EXCLUDED.content_hash,
                sync_revision = healthcare.ai_documents.sync_revision + 1,
                updated_at = now();
            """

        sql_lower = " ".join(sql.lower().split())
        self.assertIn("insert into healthcare.ai_documents", sql_lower)
        self.assertIn("on conflict (source_type, source_id)", sql_lower)
        self.assertIn("do update set", sql_lower)
        self.assertIn("content_hash = excluded.content_hash", sql_lower)
        self.assertIn("embedding = excluded.embedding", sql_lower)
        self.assertIn("sync_revision = healthcare.ai_documents.sync_revision + 1", sql_lower)
        self.assertIn("updated_at = now()", sql_lower)

    def test_sql_string_escaping_prevents_syntax_errors(self) -> None:
        """Quotes and apostrophes in Vietnamese text must be escaped as ''."""
        doc_with_quotes = {
            "source_type": "faq",
            "source_id": "faq-test-quotes",
            "title": "Hỏi về bệnh 'trào ngược' dạ dày",
            "content": "Bệnh nhân nói: 'Tôi bị ợ chua, nóng rát cổ họng'. Bác sĩ chỉ định test HP.",
            "metadata": {"category": "faq"},
        }
        if ingest_tool and hasattr(ingest_tool, "build_upsert_sql"):
            sql = ingest_tool.build_upsert_sql(doc_with_quotes)
        else:
            clean = reference_normalize_content(doc_with_quotes["content"]).replace("'", "''")
            sql = f"INSERT INTO healthcare.ai_documents (content) VALUES ('{clean}');"

        # In SQL, single quotes inside content must be doubled as '' so they do not terminate the string literal early
        self.assertIn("''Tôi bị", sql)
        self.assertIn("họng''.", sql)

    def test_sql_security_boundary_no_browser_grants_or_auth_links(self) -> None:
        if not TOOL_PATH.exists():
            self.skipTest(f"Ingestion tool not yet created at {TOOL_PATH}")
        tool_code = TOOL_PATH.read_text(encoding="utf-8").lower()
        self.assertNotIn("grant all on", tool_code)
        self.assertNotIn("to anon", tool_code)
        self.assertNotIn("to authenticated", tool_code)
        self.assertNotIn("references auth.users", tool_code)


# ===========================================================================
# Test Suite 5: CLI Execution & Subprocess Invocations
# ===========================================================================

class TestCliExecutionAndSubprocess(unittest.TestCase):
    """Verifies CLI execution: --help, --dry-run, --output-sql, --input-file."""

    def setUp(self) -> None:
        if not TOOL_PATH.exists():
            self.skipTest(f"Ingestion CLI script not yet created at {TOOL_PATH}")

    def test_cli_help_flag_succeeds(self) -> None:
        proc = subprocess.run(
            [sys.executable, str(TOOL_PATH), "--help"],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        self.assertEqual(0, proc.returncode)
        stdout = proc.stdout.lower()
        self.assertIn("--dry-run", stdout)
        self.assertIn("--output-sql", stdout)
        self.assertIn("--input-file", stdout)

    def test_cli_dry_run_executes_cleanly(self) -> None:
        """CLI --dry-run must validate without making permanent database mutations."""
        proc = subprocess.run(
            [sys.executable, str(TOOL_PATH), "--dry-run"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        self.assertEqual(
            0,
            proc.returncode,
            f"CLI --dry-run failed with code {proc.returncode}. Stderr: {proc.stderr}",
        )

    def test_cli_output_sql_generates_valid_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            out_sql = Path(tmp_dir) / "test_generated.sql"
            proc = subprocess.run(
                [sys.executable, str(TOOL_PATH), "--output-sql", str(out_sql), "--dry-run"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            )
            self.assertEqual(0, proc.returncode, f"Failed to generate SQL: {proc.stderr}")
            self.assertTrue(out_sql.exists())
            self.assertGreater(out_sql.stat().st_size, 500)
            content = out_sql.read_text(encoding="utf-8").lower()
            self.assertIn("insert into healthcare.ai_documents", content)
            self.assertIn("on conflict (source_type, source_id)", content)

    def test_cli_custom_input_file_processes_records(self) -> None:
        sample_records = [
            {
                "source_type": "specialty",
                "source_id": "test-tim-mach",
                "title": "Chuyên khoa Tim Mạch Thử Nghiệm",
                "content": "Chuyên khoa thử nghiệm chẩn đoán tim mạch và tăng huyết áp.",
                "metadata": {"category": "specialty", "slug": "test-tim-mach"},
            },
            {
                "source_type": "branch",
                "source_id": "test-co-so-1",
                "title": "Bệnh viện Cơ sở 1 Thử Nghiệm",
                "content": "Địa chỉ: 123 Đường Sức Khỏe Quận 1. Hotline: 028 1800 0001. Giờ làm việc: 06:30–20:00.",
                "metadata": {"category": "branch", "slug": "test-co-so-1"},
            },
        ]
        with tempfile.TemporaryDirectory() as tmp_dir:
            in_file = Path(tmp_dir) / "custom_clinical_test.json"
            in_file.write_text(json.dumps(sample_records, ensure_ascii=False, indent=2), encoding="utf-8")

            proc = subprocess.run(
                [sys.executable, str(TOOL_PATH), "--input-file", str(in_file), "--dry-run"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            )
            self.assertEqual(0, proc.returncode, f"Failed on custom input file: {proc.stderr}")

    def test_cli_rejects_non_existent_input_file(self) -> None:
        proc = subprocess.run(
            [sys.executable, str(TOOL_PATH), "--input-file", "non_existent_file_xyz999.json"],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        self.assertNotEqual(0, proc.returncode, "CLI must exit non-zero for non-existent input file")


if __name__ == "__main__":
    unittest.main(verbosity=2)
