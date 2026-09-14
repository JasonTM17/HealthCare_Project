"""Empirical Challenge Test Suite: Vector Math Parity, Vector Norm Rigor,
SHA-256 Stability, and SQL Idempotency.

Designed and executed by m1_challenger_2 (Vector Math & SQL Idempotency Challenger).
Verifies:
1. Vector Math Parity: ingest_clinical_knowledge._local_embedding vs
   apps/ai-service/app/embeddings._local_embedding across 50 arbitrary clinical texts (tol < 1e-7).
2. Vector Norm Rigor: abs(norm - 1.0) < 1e-5 across all generated vectors and SQL seed vectors.
3. SHA-256 Stability: Deterministic, regex ^[0-9a-f]{64}$, UTF-8 multi-byte character preservation.
4. SQL Idempotency: supabase/seed_clinical_knowledge.sql pgvector literal format,
   ON CONFLICT clause, unique keys, and transactional integrity.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
import re
import sys
import unittest
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
TOOL_PATH = REPO_ROOT / "supabase" / "tools" / "ingest_clinical_knowledge.py"
DATA_PATH = REPO_ROOT / "supabase" / "tools" / "data" / "clinical_knowledge.json"
SEED_SQL_PATH = REPO_ROOT / "supabase" / "seed_clinical_knowledge.sql"
AI_SERVICE_PATH = REPO_ROOT / "apps" / "ai-service"

if str(AI_SERVICE_PATH) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_PATH))

from app.embeddings import _local_embedding as ai_service_local_embedding


def load_ingest_tool() -> Any:
    spec = importlib.util.spec_from_file_location("ingest_clinical_knowledge", TOOL_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load spec from {TOOL_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


ingest_tool = load_ingest_tool()


def split_sql_statements_quote_aware(sql_text: str) -> list[str]:
    """Split SQL script into statements while preserving semicolons inside string literals."""
    statements: list[str] = []
    current: list[str] = []
    in_string = False
    i = 0
    n = len(sql_text)
    while i < n:
        ch = sql_text[i]
        if ch == "'":
            if in_string and i + 1 < n and sql_text[i + 1] == "'":
                current.append("''")
                i += 2
                continue
            else:
                in_string = not in_string
                current.append(ch)
                i += 1
                continue
        elif ch == ";" and not in_string:
            stmt = "".join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
            i += 1
            continue
        else:
            current.append(ch)
            i += 1
    leftover = "".join(current).strip()
    if leftover:
        statements.append(leftover)
    return statements


CLINICAL_TEST_TEXTS = [
    "Bệnh nhân đau tức ngực sau xương ức, lan lên cổ, vai trái và cánh tay trái khi gắng sức.",
    "Khó thở kịch phát về đêm, phải ngồi dậy để thở (orthopnea), kèm theo ho khan và phù mắt cá chân hai bên.",
    "Cơn đau quặn gan từng cơn vùng hạ sườn phải, sốt rét run kèm vàng da, vàng mắt (tam chứng Charcot).",
    "Đau thượng vị âm ỉ, cảm giác cồn cào, nóng rát dạ dày sau khi ăn đồ chua cay hoặc khi bụng đói.",
    "Ho khan kéo dài trên 3 tuần, ho khạc đờm đặc màu xanh vàng, sốt nhẹ về chiều và sụt cân không rõ nguyên nhân.",
    "Cơn hen phế quản cấp: khó thở thì thở ra, tiếng khò khè, co kéo cơ hô hấp phụ, SpO2 giảm còn 91%.",
    "Bệnh nhân tiểu nhiều, uống nhiều, ăn nhiều nhưng sụt cân nhanh chóng, đường huyết mao mạch bất kỳ 14.2 mmol/L.",
    "Bướu cổ to độ 2, nhịp tim nhanh 110 ck/phút khi nghỉ, run đầu chi biên độ nhỏ tần số cao, mắt lồi nhẹ.",
    "Đau nửa đầu Migraine kiểu mạch đập, sợ ánh sáng và tiếng ồn, có triệu chứng tiền triệu (aura) thị giác.",
    "Chóng mặt kịch phát lành tính theo tư thế (BPPV): cảm giác nhà cửa quay cuồng khi thay đổi tư thế xoay đầu.",
    "Tăng huyết áp nguyên phát độ 2 (JNC 7): Huyết áp tâm thu >= 160 mmHg hoặc huyết áp tâm trương >= 100 mmHg.",
    "Nhồi máu cơ tim cấp có ST chênh lên (STEMI) thành trước rộng: sóng Q hoại tử và ST chênh lên ở V1-V4.",
    "Suy tim mạn tính phân suất tống máu giảm (HFrEF, EF = 32%), NYHA III, NT-proBNP tăng cao 2450 pg/mL.",
    "Viêm gan B mạn tính tiến triển: HBsAg (+), HBeAg (+), HBV-DNA 10^7 copies/mL, ALT tăng gấp 3 lần giới hạn trên.",
    "Xơ gan Child-Pugh B do viêm gan virus C: giảm tiểu cầu, albumin máu 28 g/L, cổ trướng lượng ít.",
    "Viêm phổi cộng đồng mức độ trung bình theo thang điểm CURB-65: tri giác tỉnh, Ure 6.5, thở 26 l/p, HA 115/75.",
    "Bệnh phổi tắc nghẽn mạn tính (COPD) giai đoạn vàng nhóm D: FEV1/FVC < 0.70 sau nghiệm pháp giãn phế quản.",
    "Viêm loét đại trực tràng chảy máu (UC): đi ngoài phân nhầy máu 5-6 lần/ngày, mót rặn, đau quặn bụng dưới.",
    "Hội chứng thận hư nguyên phát: phù toàn thân, protein niệu 24h > 3.5g, albumin máu < 30g/L, tăng lipid máu.",
    "Đột quỵ thiếu máu não cục bộ cấp: yếu nửa người trái, méo miệng, thất ngôn Broca trong cửa sổ 4.5 giờ.",
    "Uống Amlodipine 5mg x 1 viên mỗi sáng lúc 8h, kết hợp Losartan 50mg x 1 viên khi HA > 140/90 mmHg.",
    "Kháng sinh Amoxicillin/Clavulanic acid 875/125mg: uống 1 viên x 2 lần/ngày sau ăn no, liệu trình 7 ngày.",
    "Insulin Glargine 100 IU/mL tiêm dưới da 16 UI vào lúc 21h hàng ngày; chỉnh liều theo đường huyết đói.",
    "Paracetamol 500mg: uống 1-2 viên khi sốt >= 38.5°C, mỗi liều cách nhau tối thiểu 4-6 giờ, tối đa 4000mg/24h.",
    "Xét nghiệm sinh hóa máu: Ure 5.2 mmol/L, Creatinine 88 µmol/L, eGFR 78 mL/phút/1.73m², Acid Uric 380 µmol/L.",
    "Bilan lipid máu: Cholesterol toàn phần 5.8 mmol/L, Triglyceride 2.4 mmol/L, LDL-C 3.6 mmol/L, HDL-C 1.0 mmol/L.",
    "Công thức máu (CBC): Bạch cầu (WBC) 12.5 x 10^9/L (Neutrophil 78%), Hồng cầu (RBC) 4.2 x 10^12/L, Hb 128 g/L.",
    "Chỉ số đông máu: PT (giây) 12.8s, % Prothrombin 85%, INR 1.08, APTT bệnh/chứng 1.02, Fibrinogen 3.2 g/L.",
    "Điện giải đồ huyết thanh: Na+ 138 mmol/L, K+ 4.1 mmol/L, Cl- 102 mmol/L, Canxi ion hóa 1.18 mmol/L.",
    "Khí máu động mạch: pH 7.38, PaCO2 39 mmHg, PaO2 88 mmHg, HCO3- 23.5 mmol/L, SaO2 96% ở khí phòng.",
    "Cơ sở 1: Số 123 Đường Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh - Hotline cấp cứu: 028 1800 0001.",
    "Cơ sở 2: Số 456 Đường Lê Văn Sỹ, Phường 14, Quận 3, TP. Hồ Chí Minh - Hotline tiếp nhận: 028 1800 0002.",
    "Chuyên khoa Cơ Xương Khớp: Tiêm acid hyaluronic nội khớp gối dưới hướng dẫn siêu âm điều trị thoái hóa khớp.",
    "Chuyên khoa Mắt (Nhãn khoa): Phẫu thuật Phaco tán nhuyễn thể thủy tinh đục, đặt kính nội nhãn IOL đơn tiêu.",
    "Chuyên khoa Da liễu & Thẩm mỹ da: Điều trị mụn trứng cá nang bọc, sẹo rỗ vi điểm Fractional CO2 laser.",
    "Quy trình khám Bảo hiểm y tế (BHYT): Xuất trình thẻ BHYT kèm CCCD gắn chip hoặc ứng dụng VssID hợp lệ.",
    "Quy trình nhập viện điều trị nội trú: Làm hồ sơ bệnh án tại Khoa Cấp cứu hoặc Phòng khám Ngoại trú.",
    "Gói tầm soát sức khỏe tổng quát chuyên sâu dành cho người cao tuổi: kiểm tra tim mạch, tiểu đường, ung bướu.",
    "Chăm sóc sau mổ nội soi cắt ruột thừa: Theo dõi dấu hiệu nhiễm trùng vết mổ, sốt, đau bụng tăng dần.",
    "Tiêm chủng vaccine phòng Cúm mùa, Phế cầu khuẩn 13 chủng, Viêm gan B cho trẻ em và người lớn có bệnh nền.",
    "Sốt",
    "H",
    "1234567890",
    "115 CẤP CỨU KHẨN CẤP: Đau thắt ngực dữ dội, ngất xỉu, hôn mê, co giật!",
    "Chỉ số HbA1c >= 6.5% hoặc đường huyết đói FPG >= 7.0 mmol/L (>= 126 mg/dL) chẩn đoán đái tháo đường.",
    "Nhiệt độ cơ thể dao động từ 37.5°C đến 39.2°C (±0.3°C), đáp ứng kém với thuốc hạ sốt thông thường.",
    "Tăng huyết áp vô căn. Bệnh mạch vành mạn tính. Thiếu máu cơ tim cục bộ. Huyết áp mục tiêu < 130/80 mmHg. " * 10,
    "Dị ứng thuốc: Tiền sử sốc phản vệ độ III với Penicillin (khó thở, phù mạch Quincke, tụt huyết áp 70/40 mmHg).",
    "Specialty: Cardiology - Department of Cardiovascular Intervention and Coronary Angiography (PCI).",
    "Khoa Hồi sức tích cực và Chống độc (ICU): Thở máy xâm nhập bảo vệ phổi, lọc máu liên tục CRRT (CVVHDF).",
]


class TestVectorMathParity(unittest.TestCase):
    """1. Vector Math Parity Challenge:

    Verifies that ingest_clinical_knowledge._local_embedding produces identical
    vectors to apps/ai-service/app/embeddings._local_embedding across 50 arbitrary
    clinical texts with tolerance < 1e-7.
    """

    def test_sample_text_count_is_at_least_50(self) -> None:
        self.assertGreaterEqual(len(CLINICAL_TEST_TEXTS), 50)

    def test_vector_dimension_is_strictly_384(self) -> None:
        for idx, text in enumerate(CLINICAL_TEST_TEXTS):
            v_ingest = ingest_tool._local_embedding(text)
            v_ai = ai_service_local_embedding(text)
            self.assertEqual(len(v_ingest), 384, f"Ingest embedding dim != 384 on sample {idx}")
            self.assertEqual(len(v_ai), 384, f"AI service embedding dim != 384 on sample {idx}")

    def test_vector_math_parity_across_50_clinical_texts(self) -> None:
        tol = 1e-7
        max_observed_diff = 0.0
        for idx, text in enumerate(CLINICAL_TEST_TEXTS):
            v_ingest = ingest_tool._local_embedding(text)
            v_ai = ai_service_local_embedding(text)

            self.assertEqual(len(v_ingest), 384)
            self.assertEqual(len(v_ai), 384)

            for dim_idx, (a, b) in enumerate(zip(v_ingest, v_ai)):
                diff = abs(a - b)
                if diff > max_observed_diff:
                    max_observed_diff = diff
                self.assertLess(
                    diff,
                    tol,
                    f"Tolerance exceeded at sample {idx}, dim {dim_idx}: |{a} - {b}| = {diff} >= {tol}",
                )

        # Confirm max difference across all 50 texts * 384 dimensions is strictly < 1e-7
        self.assertLess(max_observed_diff, tol)


class TestVectorNormRigor(unittest.TestCase):
    """2. Vector Norm Rigor Challenge:

    Verifies that every generated vector has unit length: |sqrt(sum(v_i^2)) - 1.0| < 10^-5.
    Tested across:
    - 50 arbitrary clinical texts
    - Boundary and edge case texts
    - All 215 documents in clinical_knowledge.json
    - All 215 parsed vector literals in supabase/seed_clinical_knowledge.sql
    """

    def test_vector_unit_norm_on_50_clinical_texts(self) -> None:
        norm_tol = 1e-5
        for idx, text in enumerate(CLINICAL_TEST_TEXTS):
            v = ingest_tool._local_embedding(text)
            norm = math.sqrt(sum(x * x for x in v))
            drift = abs(norm - 1.0)
            self.assertLess(
                drift,
                norm_tol,
                f"Norm drift on sample {idx} exceeded {norm_tol}: norm={norm}, drift={drift}",
            )

    def test_vector_unit_norm_on_boundary_inputs(self) -> None:
        norm_tol = 1e-5
        boundary_inputs = [
            "a",
            "X",
            "1",
            "đ",
            "ở",
            "tim",
            "sốt cao",
            "a " * 500,
            "!@#$%^&*()_+{}[]:;<>?,./~`",
            "Một từ có dấu tiếng Việt rất dài: Nghiên_cứu_khoa_học_y_dược_học_lâm_sàng",
        ]
        for inp in boundary_inputs:
            v = ingest_tool._local_embedding(inp)
            norm = math.sqrt(sum(x * x for x in v))
            drift = abs(norm - 1.0)
            self.assertLess(drift, norm_tol, f"Norm drift on boundary {inp!r}: drift={drift}")

    def test_vector_unit_norm_on_all_dataset_records(self) -> None:
        self.assertTrue(DATA_PATH.exists(), f"Dataset not found at {DATA_PATH}")
        docs = ingest_tool.load_documents_from_json(DATA_PATH)
        self.assertEqual(len(docs), 215)
        norm_tol = 1e-5
        for idx, item in enumerate(docs):
            content = item.get("content", "")
            cleaned = ingest_tool.normalize_content(content)
            v = ingest_tool._local_embedding(cleaned)
            norm = math.sqrt(sum(x * x for x in v))
            drift = abs(norm - 1.0)
            self.assertLess(
                drift,
                norm_tol,
                f"Norm drift on dataset doc {idx} ({item.get('source_type')}:{item.get('source_id')}): drift={drift}",
            )

    def test_vector_unit_norm_on_all_seed_sql_vector_literals(self) -> None:
        self.assertTrue(SEED_SQL_PATH.exists(), f"Seed SQL not found at {SEED_SQL_PATH}")
        sql_content = SEED_SQL_PATH.read_text(encoding="utf-8")
        vector_pattern = re.compile(r"'(\[-?[0-9eE., -]+\])'::extensions\.vector\(384\)")
        matches = vector_pattern.findall(sql_content)
        self.assertEqual(len(matches), 215, f"Expected 215 vector literals in seed SQL, got {len(matches)}")

        norm_tol = 1e-5
        for idx, vec_str in enumerate(matches):
            inner = vec_str.strip("[]")
            components = [float(x.strip()) for x in inner.split(",")]
            self.assertEqual(len(components), 384, f"Vector literal {idx} has {len(components)} dims")
            for c in components:
                self.assertTrue(math.isfinite(c), f"Vector literal {idx} contains non-finite component: {c}")
            norm = math.sqrt(sum(c * c for c in components))
            drift = abs(norm - 1.0)
            self.assertLess(
                drift,
                norm_tol,
                f"Vector literal {idx} norm drift {drift} >= {norm_tol} (norm={norm})",
            )


class TestSha256Stability(unittest.TestCase):
    """3. SHA-256 Stability Challenge:

    Verifies that content hashing is deterministic, strictly matches ^[0-9a-f]{64}$,
    and preserves UTF-8 multi-byte characters.
    """

    def test_sha256_hash_pattern_format(self) -> None:
        pattern = re.compile(r"^[0-9a-f]{64}$")
        for idx, text in enumerate(CLINICAL_TEST_TEXTS):
            h = ingest_tool.compute_content_hash(text)
            self.assertIsNotNone(
                pattern.fullmatch(h),
                f"Sample {idx} hash {h!r} does not match ^[0-9a-f]{{64}}$",
            )

    def test_sha256_determinism_across_100_iterations(self) -> None:
        sample_text = (
            "Phòng khám Bác sĩ Tim mạch: Điều trị tăng huyết áp vô căn, "
            "suy tim, rối loạn nhịp và bệnh mạch vành can thiệp."
        )
        reference_hash = ingest_tool.compute_content_hash(sample_text)
        for _ in range(100):
            current_hash = ingest_tool.compute_content_hash(sample_text)
            self.assertEqual(reference_hash, current_hash)

    def test_sha256_preserves_utf8_multibyte_characters(self) -> None:
        multibyte_texts = [
            "Việt Nam: Tiếng Việt có các thanh điệu: ngang, huyền, sắc, hỏi, ngã, nặng.",
            "Chữ cái đặc biệt: ă, â, đ, ê, ô, ơ, ư.",
            "Đơn vị y tế: µg/dL, mg/dL, mmol/L, °C, ±0.5, >= 140/90 mmHg, <= 120/80.",
            "Biểu tượng y tế: 🩺 🏥 💉 💊 🧬",
            "Thuật ngữ Đông y: 中医 針灸 草薬 (Y học cổ truyền châm cứu dược liệu).",
        ]
        pattern = re.compile(r"^[0-9a-f]{64}$")
        for text in multibyte_texts:
            expected_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
            actual_hash = ingest_tool.compute_content_hash(text)

            self.assertEqual(expected_hash, actual_hash)
            self.assertIsNotNone(pattern.fullmatch(actual_hash))

    def test_sha256_avalanche_effect_on_single_accent_difference(self) -> None:
        h1 = ingest_tool.compute_content_hash("nhiễm khuẩn huyết")
        h2 = ingest_tool.compute_content_hash("nhiệm khuẩn huyết")
        h3 = ingest_tool.compute_content_hash("nhiêm khuẩn huyết")

        self.assertNotEqual(h1, h2)
        self.assertNotEqual(h2, h3)
        self.assertNotEqual(h1, h3)

        b1 = bytes.fromhex(h1)
        b2 = bytes.fromhex(h2)
        bit_diff = sum((byte1 ^ byte2).bit_count() for byte1, byte2 in zip(b1, b2))
        self.assertGreater(bit_diff, 80, f"Weak avalanche effect: only {bit_diff} bits changed")

    def test_sha256_consistency_across_all_215_dataset_documents(self) -> None:
        docs = ingest_tool.load_documents_from_json(DATA_PATH)
        pattern = re.compile(r"^[0-9a-f]{64}$")
        self.assertEqual(len(docs), 215)
        for idx, doc in enumerate(docs):
            cleaned = ingest_tool.normalize_content(doc.get("content", ""))
            computed_h = ingest_tool.compute_content_hash(cleaned)
            self.assertIsNotNone(
                pattern.fullmatch(computed_h),
                f"Doc {idx} ({doc.get('source_type')}:{doc.get('source_id')}) invalid hash",
            )


class TestSqlIdempotency(unittest.TestCase):
    """4. SQL Idempotency Challenge:

    Parses supabase/seed_clinical_knowledge.sql and checks every SQL statement:
    - Valid pgvector literal format: '[...]'::extensions.vector(384)
    - Valid ON CONFLICT (source_type, source_id) DO UPDATE SET clause
    - Update clause increments sync_revision and sets updated_at = now()
    - Zero duplicate keys across all 215 statements
    - Valid transaction boundaries (BEGIN ... COMMIT)
    - Conformance to schema constraints for source_type, source_id, content_hash
    """

    @classmethod
    def setUpClass(cls) -> None:
        cls.sql_text = SEED_SQL_PATH.read_text(encoding="utf-8")
        raw_stmts = split_sql_statements_quote_aware(cls.sql_text)
        cls.all_statements = raw_stmts
        cls.statements = [
            s for s in raw_stmts
            if "INSERT INTO healthcare.ai_documents" in s
        ]

    def test_transaction_boundaries(self) -> None:
        stripped = self.sql_text.strip()
        self.assertTrue(
            re.search(r"^\s*(?:--[^\r\n]*[\r\n]+)*\s*BEGIN;", stripped),
            "Script does not begin with BEGIN;",
        )
        self.assertTrue(
            stripped.rstrip().endswith("COMMIT;"),
            "Script does not end with COMMIT;",
        )

    def test_statement_count_is_exactly_215(self) -> None:
        self.assertEqual(
            len(self.statements),
            215,
            f"Expected 215 INSERT statements, got {len(self.statements)}",
        )

    def test_every_statement_has_valid_pgvector_literal(self) -> None:
        vec_regex = re.compile(r"'(\[-?[0-9eE., -]+\])'::extensions\.vector\(384\)")
        for idx, stmt in enumerate(self.statements):
            match = vec_regex.search(stmt)
            self.assertIsNotNone(
                match,
                f"Statement {idx} does not contain valid vector(384) literal",
            )
            vec_str = match.group(1)
            values = [float(x.strip()) for x in vec_str.strip("[]").split(",")]
            self.assertEqual(len(values), 384, f"Statement {idx} vector length != 384")
            for v in values:
                self.assertTrue(math.isfinite(v), f"Statement {idx} vector component non-finite: {v}")

    def test_every_statement_has_idempotent_on_conflict_clause(self) -> None:
        conflict_clause = "ON CONFLICT (source_type, source_id) DO UPDATE SET"
        sync_revision_clause = "sync_revision = healthcare.ai_documents.sync_revision + 1"
        updated_at_clause = "updated_at = now()"

        for idx, stmt in enumerate(self.statements):
            self.assertIn(
                conflict_clause,
                stmt,
                f"Statement {idx} missing exact ON CONFLICT clause",
            )
            self.assertIn(
                sync_revision_clause,
                stmt,
                f"Statement {idx} missing sync_revision increment",
            )
            self.assertIn(
                updated_at_clause,
                stmt,
                f"Statement {idx} missing updated_at = now()",
            )

    def test_zero_duplicate_keys(self) -> None:
        key_pattern = re.compile(
            r"VALUES\s*\(\s*'([A-Za-z0-9_-]+)'\s*,\s*'([A-Za-z0-9._:-]+)'",
            re.MULTILINE,
        )
        seen_keys: list[tuple[str, str]] = []
        for idx, stmt in enumerate(self.statements):
            match = key_pattern.search(stmt)
            self.assertIsNotNone(
                match,
                f"Statement {idx} could not extract (source_type, source_id)",
            )
            source_type = match.group(1)
            source_id = match.group(2)
            seen_keys.append((source_type, source_id))

        self.assertEqual(len(seen_keys), 215)
        unique_keys = set(seen_keys)
        self.assertEqual(
            len(seen_keys),
            len(unique_keys),
            f"Duplicate keys detected! Total: {len(seen_keys)}, Unique: {len(unique_keys)}",
        )

    def test_source_types_and_source_ids_meet_db_constraints(self) -> None:
        allowed_source_types = {"specialty", "doctor", "branch", "service", "package", "article", "faq"}
        source_id_regex = re.compile(r"^[A-Za-z0-9._:-]+$")
        key_pattern = re.compile(
            r"VALUES\s*\(\s*'([A-Za-z0-9_-]+)'\s*,\s*'([A-Za-z0-9._:-]+)'",
            re.MULTILINE,
        )

        type_counts: dict[str, int] = {}
        for idx, stmt in enumerate(self.statements):
            match = key_pattern.search(stmt)
            st = match.group(1)
            sid = match.group(2)
            self.assertIn(st, allowed_source_types, f"Statement {idx} invalid source_type: {st}")
            self.assertIsNotNone(source_id_regex.fullmatch(sid), f"Statement {idx} invalid source_id: {sid}")
            self.assertTrue(1 <= len(sid) <= 200, f"Statement {idx} source_id length {len(sid)} outside [1, 200]")
            type_counts[st] = type_counts.get(st, 0) + 1

        self.assertEqual(type_counts.get("specialty"), 30)
        self.assertEqual(type_counts.get("branch"), 20)
        self.assertEqual(type_counts.get("article"), 65)
        self.assertEqual(type_counts.get("faq"), 100)

    def test_content_hashes_in_sql_match_sha256_format(self) -> None:
        hash_pattern = re.compile(r"'([0-9a-f]{64})'", re.MULTILINE)
        for idx, stmt in enumerate(self.statements):
            matches = hash_pattern.findall(stmt)
            self.assertTrue(
                len(matches) >= 1,
                f"Statement {idx} does not contain a 64-hex content_hash",
            )


if __name__ == "__main__":
    unittest.main()
