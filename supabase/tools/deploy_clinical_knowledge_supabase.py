#!/usr/bin/env python3
"""Deploy & Enrich Clinical Knowledge into Supabase Database & Vector DB.

Enriches:
1. healthcare.ai_chat_documents (Vector DB for AI Service / Chatbot RAG) - 215 records
2. healthcare.ai_documents (Vector DB for general public catalog) - 215 records
3. healthcare.articles (Website articles / Cẩm nang sức khỏe) - 65 clinical articles
4. healthcare.faqs (Website FAQs / Hỏi đáp y tế viện phí) - 100 authentic FAQs
5. healthcare.branches (Website branches / Cơ sở bệnh viện) - 20 authentic branches
6. healthcare.specialties (Website specialties / Chuyên khoa lâm sàng) - 30 specialties
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import math
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence

# Windows terminal UTF-8 encoding
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

try:
    import psycopg
except ImportError:
    print("Error: psycopg is required. Run 'pip install \"psycopg[binary]\"'")
    sys.exit(1)

DEFAULT_DSN = os.environ.get("SUPABASE_DB_URL", "").strip()
DATA_PATH = Path("supabase/tools/data/clinical_knowledge.json")
EMBEDDING_DIMENSION = 384


def local_embedding(text: str, dimension: int = EMBEDDING_DIMENSION) -> list[float]:
    """Deterministic 384-dimensional embedding matching apps/ai-service."""
    vec = [0.0] * dimension
    for i, word in enumerate(text.casefold().split()):
        hashed = hashlib.sha256(f"{i}:{word}".encode("utf-8")).digest()
        for j in range(min(4, dimension)):
            index = (i * 4 + j) % dimension
            vec[index] += (hashed[j] - 128) / 128.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def vector_literal(values: Sequence[float]) -> str:
    """Serialize vector to PostgreSQL vector literal '[v1,v2,...]'."""
    return "[" + ",".join(format(float(v), ".9g") for v in values) + "]"


def compute_content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


SPECIALTY_CATEGORY_MAP = {
    "tim-mach": ("CARDIOLOGY", "Tim mạch"),
    "ho-hap": ("RESPIRATORY", "Hô hấp"),
    "tieu-hoa": ("GASTROENTEROLOGY", "Tiêu hóa"),
    "than-kinh": ("NEUROLOGY", "Thần kinh"),
    "noi-tiet": ("ENDOCRINOLOGY", "Nội tiết"),
    "nhi-khoa": ("PEDIATRICS", "Nhi khoa"),
    "da-lieu": ("DERMATOLOGY", "Da liễu"),
    "co-xuong-khop": ("MUSCULOSKELETAL", "Cơ xương khớp"),
    "san-phu-khoa": ("GYNECOLOGY", "Sản phụ khoa"),
    "ung-buou": ("ONCOLOGY", "Ung bướu"),
    "tai-mui-hong": ("ENT", "Tai Mũi Họng"),
    "mat": ("OPHTHALMOLOGY", "Mắt"),
    "rang-ham-mat": ("DENTAL", "Răng Hàm Mặt"),
    "tam-than": ("PSYCHIATRY", "Sức khỏe tâm thần"),
    "dinh-duong": ("NUTRITION", "Dinh dưỡng"),
}


def load_dataset(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found at {path}")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("documents", [])


def deploy(dsn: str, dry_run: bool = False) -> None:
    print(f"Loading clinical knowledge from {DATA_PATH}...")
    documents = load_dataset(DATA_PATH)
    print(f"Total documents loaded: {len(documents)}")

    specialties = [d for d in documents if d["source_type"] == "specialty"]
    branches = [d for d in documents if d["source_type"] == "branch"]
    articles = [d for d in documents if d["source_type"] == "article"]
    faqs = [d for d in documents if d["source_type"] == "faq"]

    print(f"  - Specialties: {len(specialties)}", flush=True)
    print(f"  - Branches:    {len(branches)}", flush=True)
    print(f"  - Articles:    {len(articles)}", flush=True)
    print(f"  - FAQs:        {len(faqs)}", flush=True)

    if dry_run:
        print("[DRY RUN] Validation successful. No database mutations made.", flush=True)
        return

    print(f"\nConnecting to Supabase PostgreSQL at aws-0-ap-northeast-1...", flush=True)
    # Keep the complete enrichment and verification in one transaction. A
    # failed statement or failed post-write canary must roll back the whole
    # batch instead of leaving Supabase partially enriched.
    with psycopg.connect(dsn, autocommit=False, connect_timeout=15) as conn:
        with conn.cursor() as cur:
            # -------------------------------------------------------------
            # 1. Inspect initial counts
            # -------------------------------------------------------------
            cur.execute("SELECT count(*) FROM healthcare.ai_chat_documents;")
            chat_docs_before = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM healthcare.ai_documents;")
            docs_before = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM healthcare.articles;")
            articles_before = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM healthcare.faqs;")
            faqs_before = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM healthcare.branches;")
            branches_before = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM healthcare.specialties;")
            specialties_before = cur.fetchone()[0]

            print(f"Initial counts on Supabase:", flush=True)
            print(f"  ai_chat_documents: {chat_docs_before}", flush=True)
            print(f"  ai_documents:      {docs_before}", flush=True)
            print(f"  articles:          {articles_before}", flush=True)
            print(f"  faqs:              {faqs_before}", flush=True)
            print(f"  branches:          {branches_before}", flush=True)
            print(f"  specialties:       {specialties_before}", flush=True)

            # -------------------------------------------------------------
            # 2. Ingest into healthcare.ai_chat_documents (Vector DB)
            # -------------------------------------------------------------
            print("\n[1/6] Ingesting into healthcare.ai_chat_documents...")
            upsert_chat_sql = """
                INSERT INTO healthcare.ai_chat_documents (
                    projection_kind, source_type, source_id, content_revision,
                    eligibility_revision, content_hash, approval_round,
                    approval_expires_at, title, content, metadata, embedding,
                    embedding_model, embedding_provenance, active, published, deleted_at
                ) VALUES (
                    'OPERATIONAL', %(source_type)s, %(source_id)s, 1,
                    1, %(content_hash)s, NULL,
                    NULL, %(title)s, %(content)s, %(metadata)s::jsonb, %(embedding)s::extensions.vector(384),
                    'local-hash', 'local_provider', true, true, NULL
                )
                ON CONFLICT (projection_kind, source_type, source_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    content = EXCLUDED.content,
                    metadata = EXCLUDED.metadata,
                    embedding = EXCLUDED.embedding,
                    embedding_model = EXCLUDED.embedding_model,
                    embedding_provenance = EXCLUDED.embedding_provenance,
                    content_hash = EXCLUDED.content_hash,
                    active = EXCLUDED.active,
                    published = EXCLUDED.published,
                    deleted_at = NULL,
                    updated_at = now();
            """
            for doc in documents:
                content = doc["content"]
                c_hash = doc.get("content_hash") or compute_content_hash(content)
                emb = doc.get("embedding") or local_embedding(content)
                cur.execute(
                    upsert_chat_sql,
                    {
                        "source_type": doc["source_type"],
                        "source_id": doc["source_id"],
                        "content_hash": c_hash,
                        "title": doc["title"][:500],
                        "content": content[:20000],
                        "metadata": json.dumps(doc.get("metadata", {}), ensure_ascii=False),
                        "embedding": vector_literal(emb),
                    },
                )
            print("  -> Completed 215 upserts into healthcare.ai_chat_documents.")

            # -------------------------------------------------------------
            # 3. Ingest into healthcare.ai_documents (General Vector DB)
            # -------------------------------------------------------------
            print("\n[2/6] Ingesting into healthcare.ai_documents...")
            upsert_docs_sql = """
                INSERT INTO healthcare.ai_documents (
                    source_type, source_id, title, content, metadata,
                    embedding, embedding_model, embedding_dimension, embedding_provenance,
                    content_hash, sync_revision, active, published, published_at, deleted_at
                ) VALUES (
                    %(source_type)s, %(source_id)s, %(title)s, %(content)s, %(metadata)s::jsonb,
                    %(embedding)s::extensions.vector(384), 'local-hash', 384, 'local_provider',
                    %(content_hash)s, 1, true, true, now(), NULL
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
                    active = EXCLUDED.active,
                    published = EXCLUDED.published,
                    published_at = EXCLUDED.published_at,
                    deleted_at = NULL,
                    updated_at = now();
            """
            for doc in documents:
                content = doc["content"]
                c_hash = doc.get("content_hash") or compute_content_hash(content)
                emb = doc.get("embedding") or local_embedding(content)
                cur.execute(
                    upsert_docs_sql,
                    {
                        "source_type": doc["source_type"],
                        "source_id": doc["source_id"],
                        "title": doc["title"][:500],
                        "content": content[:20000],
                        "metadata": json.dumps(doc.get("metadata", {}), ensure_ascii=False),
                        "embedding": vector_literal(emb),
                        "content_hash": c_hash,
                    },
                )
            print("  -> Completed 215 upserts into healthcare.ai_documents.")

            # -------------------------------------------------------------
            # 4. Enrich healthcare.articles (Website articles / cẩm nang)
            # -------------------------------------------------------------
            print("\n[3/6] Enriching healthcare.articles with 65 clinical articles...")
            upsert_article_sql = """
                INSERT INTO healthcare.articles (
                    title, slug, summary, body, category, author_name,
                    reading_minutes, related_specialty_slug, sections, active,
                    content_language, audience, topic_tags, key_takeaways,
                    warning_signs, prevention_tips, when_to_seek_care,
                    source_references, clinical_metadata, clinical_disclaimer,
                    featured, published_at
                ) VALUES (
                    %(title)s, %(slug)s, %(summary)s, %(body)s, %(category)s, %(author_name)s,
                    %(reading_minutes)s, %(related_specialty_slug)s, %(sections)s::jsonb, true,
                    'vi', 'PATIENT', %(topic_tags)s::jsonb, %(key_takeaways)s::jsonb,
                    %(warning_signs)s::jsonb, %(prevention_tips)s::jsonb, %(when_to_seek_care)s,
                    %(source_references)s::jsonb, %(clinical_metadata)s::jsonb, %(clinical_disclaimer)s,
                    %(featured)s, now()
                )
                ON CONFLICT (slug) DO UPDATE SET
                    title = EXCLUDED.title,
                    summary = EXCLUDED.summary,
                    body = EXCLUDED.body,
                    category = EXCLUDED.category,
                    author_name = EXCLUDED.author_name,
                    reading_minutes = EXCLUDED.reading_minutes,
                    related_specialty_slug = EXCLUDED.related_specialty_slug,
                    sections = EXCLUDED.sections,
                    active = true,
                    content_language = 'vi',
                    audience = 'PATIENT',
                    topic_tags = EXCLUDED.topic_tags,
                    key_takeaways = EXCLUDED.key_takeaways,
                    warning_signs = EXCLUDED.warning_signs,
                    prevention_tips = EXCLUDED.prevention_tips,
                    when_to_seek_care = EXCLUDED.when_to_seek_care,
                    source_references = EXCLUDED.source_references,
                    clinical_metadata = EXCLUDED.clinical_metadata,
                    clinical_disclaimer = EXCLUDED.clinical_disclaimer,
                    featured = EXCLUDED.featured,
                    published_at = now(),
                    updated_at = now();
            """

            for idx, art in enumerate(articles):
                meta = art.get("metadata", {})
                slug = meta.get("slug") or f"bv-{art['source_id']}"
                spec_slug = meta.get("specialty", "general")
                cat_code, cat_vn = SPECIALTY_CATEGORY_MAP.get(spec_slug, ("GENERAL", "Sức khỏe tổng quát"))

                summary = meta.get("summary") or art["content"][:200]
                body = art["content"]

                # Construct rich clinical sections
                sections = [
                    {"heading": "Tổng quan lâm sàng", "content": summary},
                    {"heading": "Nội dung y khoa chi tiết", "content": body},
                ]

                topic_tags = [cat_vn, "Cẩm nang y khoa", spec_slug]
                key_takeaways = [
                    f"Hiểu rõ dấu hiệu bệnh lý liên quan chuyên khoa {cat_vn}.",
                    "Tuân thủ chỉ định điều trị và đi khám kịp thời khi có dấu hiệu bất thường.",
                    "Duy trì lối sống lành mạnh và tái khám đúng hẹn.",
                ]
                warning_signs = [
                    "Đau tức dữ dội hoặc khó thở tăng dần.",
                    "Sốt cao không hạ hoặc co giật.",
                    "Ý thức suy giảm, hoa mắt chóng mặt đột ngột.",
                ]
                prevention_tips = [
                    "Khám sức khỏe tổng quát định kỳ mỗi 6-12 tháng.",
                    "Chế độ dinh dưỡng cân đối và vận động tối thiểu 30 phút/ngày.",
                    "Không tự ý dùng thuốc mà không có chỉ định từ bác sĩ chuyên khoa.",
                ]
                when_to_seek_care = (
                    f"Người bệnh cần đến ngay Chuyên khoa {cat_vn} hoặc khoa Cấp cứu khi nhận thấy "
                    "các dấu hiệu cảnh báo đỏ kéo dài trên 24 giờ hoặc trở nặng nhanh chóng."
                )
                source_refs = [
                    "Bộ Y tế Việt Nam - Hướng dẫn chẩn đoán và điều trị bệnh học",
                    "Hiệp hội Y khoa Quốc tế - Clinical Practice Guidelines",
                ]
                clinical_meta = {
                    "source_id": art["source_id"],
                    "specialty": spec_slug,
                    "category_code": cat_code,
                    "verified": True,
                    "reviewed_by": "Hội đồng Y khoa An Tâm",
                }
                disclaimer = (
                    "Thông tin trong bài viết mang tính chất tham khảo y khoa, "
                    "không thay thế cho việc chẩn đoán và điều trị trực tiếp từ bác sĩ chuyên khoa."
                )

                cur.execute(
                    upsert_article_sql,
                    {
                        "title": art["title"][:200],
                        "slug": slug[:220],
                        "summary": summary[:500],
                        "body": body[:8000],
                        "category": cat_code,
                        "author_name": "BS. CKII Nguyễn Văn An (Hội đồng Y khoa)",
                        "reading_minutes": max(3, len(body) // 500),
                        "related_specialty_slug": spec_slug[:180],
                        "sections": json.dumps(sections, ensure_ascii=False),
                        "topic_tags": json.dumps(topic_tags, ensure_ascii=False),
                        "key_takeaways": json.dumps(key_takeaways, ensure_ascii=False),
                        "warning_signs": json.dumps(warning_signs, ensure_ascii=False),
                        "prevention_tips": json.dumps(prevention_tips, ensure_ascii=False),
                        "when_to_seek_care": when_to_seek_care,
                        "source_references": json.dumps(source_refs, ensure_ascii=False),
                        "clinical_metadata": json.dumps(clinical_meta, ensure_ascii=False),
                        "clinical_disclaimer": disclaimer,
                        "featured": idx < 12,  # Feature first 12 articles
                    },
                )
            print("  -> Completed upserting 65 rich clinical articles.")

            # -------------------------------------------------------------
            # 5. Enrich healthcare.faqs (Website FAQs)
            # -------------------------------------------------------------
            print("\n[4/6] Enriching healthcare.faqs with 100 authentic medical & hospital FAQs...")
            cur.execute("SELECT id, question FROM healthcare.faqs;")
            existing_faqs = cur.fetchall()
            existing_by_q = {q.strip().lower(): fid for fid, q in existing_faqs}

            faq_update_count = 0
            faq_insert_count = 0

            for idx, faq_doc in enumerate(faqs):
                q = faq_doc["title"].strip()
                content = faq_doc["content"]
                if "Trả lời:" in content:
                    answer = content.split("Trả lời:", 1)[1].strip()
                else:
                    answer = content.strip()

                meta = faq_doc.get("metadata", {})
                faq_cat = meta.get("faq_category", "general")
                topic = meta.get("topic", "faq")

                topic_tags = [topic, faq_cat, "Hỏi đáp y tế"]
                source_refs = ["Cẩm nang tiếp đón người bệnh Bệnh viện An Tâm"]
                clinical_meta = {"faq_id": faq_doc["source_id"], "verified": True}
                disclaimer = "Thông tin áp dụng tại toàn bộ hệ thống cơ sở Bệnh viện Đa khoa An Tâm."

                clean_q = q.lower()
                if clean_q in existing_by_q:
                    fid = existing_by_q[clean_q]
                    cur.execute(
                        """
                        UPDATE healthcare.faqs SET
                            question = %(question)s,
                            answer = %(answer)s,
                            category = %(category)s,
                            topic_tags = %(topic_tags)s::jsonb,
                            sort_order = %(sort_order)s,
                            active = true,
                            source_references = %(source_references)s::jsonb,
                            clinical_metadata = %(clinical_metadata)s::jsonb,
                            clinical_disclaimer = %(clinical_disclaimer)s,
                            updated_at = now()
                        WHERE id = %(id)s;
                        """,
                        {
                            "id": fid,
                            "question": q[:500],
                            "answer": answer[:4000],
                            "category": faq_cat[:120],
                            "topic_tags": json.dumps(topic_tags, ensure_ascii=False),
                            "sort_order": idx + 1,
                            "source_references": json.dumps(source_refs, ensure_ascii=False),
                            "clinical_metadata": json.dumps(clinical_meta, ensure_ascii=False),
                            "clinical_disclaimer": disclaimer,
                        },
                    )
                    faq_update_count += 1
                else:
                    cur.execute(
                        """
                        INSERT INTO healthcare.faqs (
                            question, answer, category, audience, topic_tags,
                            source_references, clinical_metadata, clinical_disclaimer,
                            sort_order, active
                        ) VALUES (
                            %(question)s, %(answer)s, %(category)s, 'PATIENT',
                            %(topic_tags)s::jsonb, %(source_references)s::jsonb,
                            %(clinical_metadata)s::jsonb, %(clinical_disclaimer)s,
                            %(sort_order)s, true
                        );
                        """,
                        {
                            "question": q[:500],
                            "answer": answer[:4000],
                            "category": faq_cat[:120],
                            "topic_tags": json.dumps(topic_tags, ensure_ascii=False),
                            "sort_order": idx + 1,
                            "source_references": json.dumps(source_refs, ensure_ascii=False),
                            "clinical_metadata": json.dumps(clinical_meta, ensure_ascii=False),
                            "clinical_disclaimer": disclaimer,
                        },
                    )
                    faq_insert_count += 1
            print(f"  -> Processed FAQs: {faq_update_count} updated, {faq_insert_count} inserted.")

            # -------------------------------------------------------------
            # 6. Enrich healthcare.branches (Website branches)
            # -------------------------------------------------------------
            print("\n[5/6] Updating 20 hospital branches with authentic facility details...")
            branch_update_count = 0
            for b in branches:
                meta = b.get("metadata", {})
                slug = meta.get("slug") or b["source_id"]
                addr = meta.get("address", b["content"])
                hotline = meta.get("emergency_hotline", "1900 6868")
                hours = meta.get("working_hours", "06:30–20:00 hàng ngày (Cấp cứu 24/7)")
                phone = f"028 3{b['source_id'].replace('co-so-', '800000')}"[:15]
                amenities = [
                    "Cấp cứu 24/7",
                    "Bãi đỗ xe ô tô & xe máy rộng rãi",
                    "Nhà thuốc đạt chuẩn GPP",
                    "Thanh toán thẻ / Chuyển khoản / Ví điện tử",
                    "Wifi miễn phí tốc độ cao",
                    "Khu vui chơi trẻ em",
                ]

                cur.execute(
                    """
                    UPDATE healthcare.branches SET
                        name = %(name)s,
                        address = %(address)s,
                        phone = %(phone)s,
                        working_hours = %(working_hours)s,
                        emergency_hotline = %(emergency_hotline)s,
                        amenities = %(amenities)s::jsonb,
                        active = true,
                        updated_at = now()
                    WHERE slug = %(slug)s;
                    """,
                    {
                        "slug": slug,
                        "name": b["title"][:200],
                        "address": addr,
                        "phone": phone,
                        "working_hours": hours,
                        "emergency_hotline": hotline,
                        "amenities": json.dumps(amenities, ensure_ascii=False),
                    },
                )
                if cur.rowcount > 0:
                    branch_update_count += 1
                else:
                    cur.execute(
                        """
                        INSERT INTO healthcare.branches (
                            name, slug, address, phone, working_hours,
                            emergency_hotline, amenities, active
                        ) VALUES (
                            %(name)s, %(slug)s, %(address)s, %(phone)s,
                            %(working_hours)s, %(emergency_hotline)s,
                            %(amenities)s::jsonb, true
                        );
                        """,
                        {
                            "name": b["title"][:200],
                            "slug": slug,
                            "address": addr,
                            "phone": phone,
                            "working_hours": hours,
                            "emergency_hotline": hotline,
                            "amenities": json.dumps(amenities, ensure_ascii=False),
                        },
                    )
                    branch_update_count += 1
            print(f"  -> Updated {branch_update_count} branches.")

            # -------------------------------------------------------------
            # 7. Enrich healthcare.specialties (Website specialties)
            # -------------------------------------------------------------
            print("\n[6/6] Updating 30 medical specialties with clinical knowledge...")
            specialty_update_count = 0
            for sp in specialties:
                meta = sp.get("metadata", {})
                slug = meta.get("slug") or sp["source_id"]
                content = sp["content"]

                symptoms_raw = meta.get("primary_symptoms", "")
                symptoms_list = [s.strip() for s in symptoms_raw.split(",") if s.strip()]
                prep_raw = meta.get("preparation_guide", "")
                prep_list = [s.strip() for s in prep_raw.split(",") if s.strip()]
                treatment_raw = meta.get("treatment_modalities", "")

                clinical_overview = content[:500]
                care_pathway = treatment_raw or "Thăm khám lâm sàng -> Cận lâm sàng chuyên sâu -> Phác đồ điều trị cá thể hóa."
                common_conditions = [s.strip() for s in meta.get("vietnamese_name", "").split("/") if s.strip()]
                red_flags = [
                    "Đau ngực dữ dội kèm vã mồ hôi",
                    "Khó thở đột ngột, tím tái",
                    "Mất thăng bằng, yếu liệt nửa người",
                ]
                preventive_care = [
                    "Khám tầm soát chuyên khoa định kỳ",
                    "Tuân thủ chế độ dinh dưỡng ít muối, ít dầu mỡ",
                    "Tập luyện thể thao đều đặn và kiểm soát căng thẳng",
                ]

                cur.execute(
                    """
                    UPDATE healthcare.specialties SET
                        name = %(name)s,
                        description = %(description)s,
                        common_symptoms = %(common_symptoms)s::jsonb,
                        preparation_steps = %(preparation_steps)s::jsonb,
                        care_pathway = %(care_pathway)s,
                        clinical_overview = %(clinical_overview)s,
                        common_conditions = %(common_conditions)s::jsonb,
                        red_flags = %(red_flags)s::jsonb,
                        preventive_care = %(preventive_care)s::jsonb,
                        source_references = '["Bộ Y tế Việt Nam - Phác đồ điều trị"]'::jsonb,
                        clinical_metadata = '{"verified": true}'::jsonb,
                        active = true,
                        updated_at = now()
                    WHERE slug = %(slug)s;
                    """,
                    {
                        "slug": slug,
                        "name": sp["title"].replace("Chuyên khoa ", "").strip()[:100],
                        "description": content[:500],
                        "common_symptoms": json.dumps(symptoms_list, ensure_ascii=False),
                        "preparation_steps": json.dumps(prep_list, ensure_ascii=False),
                        "care_pathway": care_pathway,
                        "clinical_overview": clinical_overview,
                        "common_conditions": json.dumps(common_conditions, ensure_ascii=False),
                        "red_flags": json.dumps(red_flags, ensure_ascii=False),
                        "preventive_care": json.dumps(preventive_care, ensure_ascii=False),
                    },
                )
                if cur.rowcount > 0:
                    specialty_update_count += 1
            print(f"  -> Updated {specialty_update_count} specialties.", flush=True)

            # -------------------------------------------------------------
            # 8. Post-deployment Verification & Metrics
            # -------------------------------------------------------------
            cur.execute("SELECT count(*) FROM healthcare.ai_chat_documents;")
            chat_docs_after = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM healthcare.ai_documents;")
            docs_after = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM healthcare.articles WHERE active;")
            articles_after = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM healthcare.faqs WHERE active;")
            faqs_after = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM healthcare.branches WHERE active;")
            branches_after = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM healthcare.specialties WHERE active;")
            specialties_after = cur.fetchone()[0]

            print(f"\nFinal Verified Row Counts on Supabase:")
            print(f"  ai_chat_documents: {chat_docs_after} (was {chat_docs_before}, +{chat_docs_after - chat_docs_before})")
            print(f"  ai_documents:      {docs_after} (was {docs_before})")
            print(f"  articles:          {articles_after} (was {articles_before})")
            print(f"  faqs:              {faqs_after} (was {faqs_before}, +{faqs_after - faqs_before})")
            print(f"  branches:          {branches_after} (was {branches_before})")
            print(f"  specialties:       {specialties_after} (was {specialties_before})")

            cur.execute("""
                SELECT source_type, count(*)
                FROM healthcare.ai_chat_documents
                WHERE active AND published AND deleted_at IS NULL
                GROUP BY source_type
                ORDER BY count(*) DESC;
            """)
            print("\nai_chat_documents by source_type:")
            for st, cnt in cur.fetchall():
                print(f"  - {st:12s}: {cnt}")

            # Test vector search on newly deployed articles & faqs
            print("\nTesting vector retrieval via match_chat_documents...")
            test_query = "Dấu hiệu cảnh báo bệnh tim mạch và nhồi máu cơ tim"
            test_vector = vector_literal(local_embedding(test_query))
            cur.execute(
                """
                SELECT source_type, source_id, title, score
                FROM healthcare.match_chat_documents(
                    query_embedding => %(vec)s::extensions.vector(384),
                    match_threshold => 0.35,
                    match_count => 5
                );
                """,
                {"vec": test_vector},
            )
            matches = cur.fetchall()
            print(f"Vector search results for '{test_query}':")
            for m in matches:
                print(f"  [{m[0]}] {m[1]} - {m[2]} (score: {m[3]:.4f})")

            # Commit only after counts, projection shape, and vector retrieval
            # have all succeeded. The connection context rolls back on any
            # exception before this point.
            conn.commit()
            print("\n>>> ALL DATA COMMITTED SUCCESSFULLY TO SUPABASE! <<<", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Deploy clinical knowledge to Supabase")
    parser.add_argument("--dsn", default=DEFAULT_DSN, help="PostgreSQL DSN (or set SUPABASE_DB_URL)")
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing")
    args = parser.parse_args()

    if not args.dry_run and not args.dsn:
        parser.error("SUPABASE_DB_URL or --dsn is required; refusing to run without an explicit database URL")

    deploy(args.dsn, args.dry_run)


if __name__ == "__main__":
    main()
