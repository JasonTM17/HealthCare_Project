#!/usr/bin/env python3
"""Clinical Knowledge Ingestion CLI for Supabase pgvector.

Ingests authentic medical knowledge (specialties, branches, articles, FAQs)
from JSON and/or Markdown into ``healthcare.ai_documents``.

Features:
- Deterministic 384-dimensional embedding matching ``apps/ai-service`` with zero heavy ML dependencies.
- HTML tag cleaning, entity unescaping, and whitespace collapsing.
- SHA-256 content hashing enforcing strict database constraints.
- Idempotent upsert SQL generation: ``ON CONFLICT (source_type, source_id) DO UPDATE SET ...``.
- Dry-run validation of document bounds, vector shapes, hashes, and schemas.
- Dual execution support: standalone SQL generation, direct psycopg, or psql execution.
"""

from __future__ import annotations

import argparse
import hashlib
import html
from html.parser import HTMLParser
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Sequence

# Ensure UTF-8 output on Windows terminal
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# -----------------------------------------------------------------------------
# Configuration Constants & Database Contract
# -----------------------------------------------------------------------------
DEFAULT_INPUT_FILE = Path("supabase/tools/data/clinical_knowledge.json")
DEFAULT_OUTPUT_SQL = Path("supabase/seed_clinical_knowledge.sql")
DEFAULT_TABLE = "healthcare.ai_documents"
EMBEDDING_DIMENSION = 384
DEFAULT_MODEL = "local-hash"
DEFAULT_PROVENANCE = "local_provider"

ALLOWED_SOURCE_TYPES = frozenset(
    {"specialty", "doctor", "branch", "service", "package", "article", "faq"}
)
ALLOWED_PROVENANCES = frozenset(
    {"local_provider", "remote_provider", "local_fallback"}
)

MAX_CONTENT_CHARS = 20_000
MIN_CONTENT_CHARS = 1
MAX_SOURCE_ID_CHARS = 200
SOURCE_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]+$")
CONTENT_HASH_PATTERN = re.compile(r"^[0-9a-f]{64}$")
_IGNORED_HTML_TAGS = frozenset({"script", "style", "noscript", "template"})


# -----------------------------------------------------------------------------
# Data Models
# -----------------------------------------------------------------------------
@dataclass
class ClinicalDocument:
    """Represents a validated clinical document ready for Supabase vector ingestion."""

    source_type: str
    source_id: str
    title: str
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)
    embedding: list[float] = field(default_factory=list)
    embedding_model: str = DEFAULT_MODEL
    embedding_dimension: int = EMBEDDING_DIMENSION
    embedding_provenance: str = DEFAULT_PROVENANCE
    content_hash: str = ""
    sync_revision: int = 1
    active: bool = True
    published: bool = True
    published_at: str | None = None
    deleted_at: str | None = None


# -----------------------------------------------------------------------------
# Text Normalization & Hashing
# -----------------------------------------------------------------------------
class _VisibleTextParser(HTMLParser):
    """Extract visible text while stripping script, style, and template tags."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._ignored_depth = 0
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        if tag.casefold() in _IGNORED_HTML_TAGS:
            self._ignored_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.casefold() in _IGNORED_HTML_TAGS and self._ignored_depth:
            self._ignored_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self._ignored_depth:
            self._parts.append(data)

    @property
    def text(self) -> str:
        return " ".join(self._parts)


def normalize_content(content: str) -> str:
    """Normalize HTML/markdown text to bounded, unescaped, clean visible text.

    Ported from ``apps/ai-service/app/rag.py`` to guarantee 100% token consistency.
    """
    if not content:
        return ""

    parser = _VisibleTextParser()
    try:
        parser.feed(content)
        parser.close()
        visible = parser.text
    except Exception:
        # Fallback tag stripping on malformed HTML
        visible = re.sub(
            r"<\s*(script|style|noscript|template)\b[^>]*>.*?<\s*/\s*\1\s*>",
            " ",
            content,
            flags=re.IGNORECASE | re.DOTALL,
        )
        visible = re.sub(r"<[^>]*>", " ", visible)

    normalized = " ".join(html.unescape(visible).split())
    return re.sub(r"\s+([,.;:!?、。！？])", r"\1", normalized)


# Alias for contract tests
normalize_text = normalize_content


def compute_content_hash(text: str) -> str:
    """Compute SHA-256 hex digest for document deduplication and database constraint."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# -----------------------------------------------------------------------------
# Deterministic 384-dimensional Embeddings
# -----------------------------------------------------------------------------
def _local_embedding(text: str, dimension: int = EMBEDDING_DIMENSION) -> list[float]:
    """Deterministic, dependency-free embedding matching ``apps/ai-service/app/embeddings.py``.

    Generates a 384-dimensional unit vector using SHA-256 word hashing with zero
    heavy external dependencies (no PyTorch, no transformers).
    """
    vec = [0.0] * dimension
    for i, word in enumerate(text.casefold().split()):
        hashed = hashlib.sha256(f"{i}:{word}".encode("utf-8")).digest()
        for j in range(min(4, dimension)):
            index = (i * 4 + j) % dimension
            vec[index] += (hashed[j] - 128) / 128.0
    norm = math.sqrt(sum(value * value for value in vec)) or 1.0
    return [value / norm for value in vec]


# Alias for contract tests
compute_embedding = _local_embedding


def vector_literal(values: Sequence[float], dimension: int = EMBEDDING_DIMENSION) -> str:
    """Serialize a finite, fixed-size vector to pgvector's text literal form ``[v_0, ...]``."""
    if len(values) != dimension:
        raise ValueError(
            f"Embedding dimension {len(values)} does not match required dimension {dimension}"
        )
    normalized: list[str] = []
    for value in values:
        number = float(value)
        if not math.isfinite(number):
            raise ValueError("Embedding contains non-finite value")
        normalized.append(format(number, ".9g"))
    return "[" + ",".join(normalized) + "]"


# Alias for contract tests
format_vector_literal = vector_literal


# -----------------------------------------------------------------------------
# SQL Serialization Helpers
# -----------------------------------------------------------------------------
def sql_literal(value: str | None) -> str:
    """Escape and wrap a string in SQL single quotes, or return NULL."""
    if value is None:
        return "NULL"
    escaped = value.replace("'", "''")
    return f"'{escaped}'"


def jsonb_literal(data: dict[str, Any]) -> str:
    """Serialize dictionary to a PostgreSQL jsonb literal."""
    json_str = json.dumps(data, ensure_ascii=False, sort_keys=True)
    escaped = json_str.replace("'", "''")
    return f"'{escaped}'::jsonb"


def boolean_literal(value: bool) -> str:
    """Return SQL boolean literal."""
    return "true" if value else "false"


# -----------------------------------------------------------------------------
# Document Loaders & Parsers
# -----------------------------------------------------------------------------
def parse_markdown_file(path: Path) -> dict[str, Any]:
    """Parse a Markdown file with optional YAML frontmatter into a raw document dict."""
    text = path.read_text(encoding="utf-8")
    metadata: dict[str, Any] = {}
    body = text

    # Check for YAML frontmatter block
    fm_match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.DOTALL)
    if fm_match:
        fm_text, body = fm_match.groups()
        for line in fm_text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if ":" in line:
                key, val = line.split(":", 1)
                k = key.strip()
                v = val.strip().strip("'\"")
                if v.lower() == "true":
                    metadata[k] = True
                elif v.lower() == "false":
                    metadata[k] = False
                else:
                    metadata[k] = v

    source_id = str(metadata.get("source_id") or path.stem).strip()
    source_type = str(metadata.get("source_type") or "article").strip().lower()

    # Extract title from frontmatter or first H1 header
    title = str(metadata.get("title") or "").strip()
    if not title:
        h1_match = re.search(r"^#\s+(.+)$", body, re.MULTILINE)
        if h1_match:
            title = h1_match.group(1).strip()
        else:
            title = path.stem.replace("-", " ").replace("_", " ").title()

    # Base metadata dictionary
    doc_metadata: dict[str, Any] = {
        "slug": metadata.get("slug") or source_id,
        "category": metadata.get("category") or source_type,
    }
    for k, v in metadata.items():
        if k not in {"source_type", "source_id", "title", "content", "published_at", "active", "published"}:
            doc_metadata[k] = v

    return {
        "source_type": source_type,
        "source_id": source_id,
        "title": title,
        "content": body.strip(),
        "metadata": doc_metadata,
        "active": bool(metadata.get("active", True)),
        "published": bool(metadata.get("published", True)),
        "published_at": metadata.get("published_at"),
    }


def load_documents_from_json(path: Path) -> list[dict[str, Any]]:
    """Load documents from JSON file. Supports list, dict with 'documents', and grouped dicts."""
    if not path.exists():
        raise FileNotFoundError(f"Input JSON file not found: {path}")

    data = json.loads(path.read_text(encoding="utf-8"))
    documents: list[dict[str, Any]] = []

    if isinstance(data, list):
        documents.extend(data)
    elif isinstance(data, dict):
        if "documents" in data and isinstance(data["documents"], list):
            documents.extend(data["documents"])
        else:
            for key, value in data.items():
                if isinstance(value, list):
                    for item in value:
                        if isinstance(item, dict):
                            if "source_type" not in item:
                                if key in ALLOWED_SOURCE_TYPES:
                                    item["source_type"] = key
                                elif key.endswith("s") and key[:-1] in ALLOWED_SOURCE_TYPES:
                                    item["source_type"] = key[:-1]
                            documents.append(item)
    else:
        raise ValueError(f"Unexpected JSON root structure in {path}: expected list or dict")

    return documents


def load_documents_from_markdown_dir(dir_path: Path) -> list[dict[str, Any]]:
    """Recursively discover and parse markdown files in a directory."""
    if not dir_path.exists() or not dir_path.is_dir():
        raise NotADirectoryError(f"Markdown directory not found: {dir_path}")

    documents: list[dict[str, Any]] = []
    for md_file in sorted(dir_path.glob("**/*.md")):
        documents.append(parse_markdown_file(md_file))
    for md_file in sorted(dir_path.glob("**/*.markdown")):
        documents.append(parse_markdown_file(md_file))

    return documents


# -----------------------------------------------------------------------------
# Validation & Document Construction
# -----------------------------------------------------------------------------
def validate_and_normalize_document(
    raw: dict[str, Any],
    model: str = DEFAULT_MODEL,
    provenance: str = DEFAULT_PROVENANCE,
    dimension: int = EMBEDDING_DIMENSION,
) -> ClinicalDocument:
    """Validate raw document properties and generate embedding and hash.

    Enforces all database constraints:
    - ``source_type in ('specialty', 'doctor', 'branch', 'service', 'package', 'article', 'faq')``
    - ``source_id ~ '^[A-Za-z0-9._:-]+$' and length between 1 and 200``
    - ``length(content) between 1 and 20000``
    - ``content_hash ~ '^[0-9a-f]{64}$'``
    - ``embedding_dimension = 384`` with finite unit-length vector
    - ``jsonb_typeof(metadata) = 'object'``
    """
    # 1. Validate source_type
    raw_source_type = str(raw.get("source_type") or "").strip().lower()
    if raw_source_type not in ALLOWED_SOURCE_TYPES:
        raise ValueError(
            f"Invalid source_type {raw_source_type!r}. Allowed: {sorted(ALLOWED_SOURCE_TYPES)}"
        )

    # 2. Validate source_id
    source_id = str(raw.get("source_id") or "").strip()
    if not (1 <= len(source_id) <= MAX_SOURCE_ID_CHARS):
        raise ValueError(
            f"source_id length {len(source_id)} outside [1, {MAX_SOURCE_ID_CHARS}] in doc: {source_id}"
        )
    if not SOURCE_ID_PATTERN.fullmatch(source_id):
        raise ValueError(f"source_id {source_id!r} does not match pattern ^[A-Za-z0-9._:-]+$")

    # 3. Validate title
    title = str(raw.get("title") or "").strip()
    if not title:
        raise ValueError(f"Document {raw_source_type}:{source_id} missing title")

    # 4. Normalize & validate content
    raw_content = str(raw.get("content") or "")
    cleaned_content = normalize_content(raw_content)
    if not (MIN_CONTENT_CHARS <= len(cleaned_content) <= MAX_CONTENT_CHARS):
        raise ValueError(
            f"Document {raw_source_type}:{source_id} content length {len(cleaned_content)} "
            f"outside [{MIN_CONTENT_CHARS}, {MAX_CONTENT_CHARS}]"
        )

    # 5. Metadata validation
    raw_meta = raw.get("metadata")
    if raw_meta is None:
        metadata: dict[str, Any] = {}
    elif isinstance(raw_meta, dict):
        metadata = dict(raw_meta)
    else:
        raise ValueError(f"Document {raw_source_type}:{source_id} metadata must be a JSON object")

    if "slug" not in metadata:
        metadata["slug"] = source_id
    if "category" not in metadata:
        metadata["category"] = raw_source_type

    # 6. Compute deterministic hash and embedding
    content_hash = compute_content_hash(cleaned_content)
    if not CONTENT_HASH_PATTERN.fullmatch(content_hash):
        raise ValueError(f"Invalid content_hash generated: {content_hash}")

    # Generate deterministic embedding from cleaned content
    computed_emb = _local_embedding(cleaned_content, dimension=dimension)
    existing_emb = raw.get("embedding")
    if (
        isinstance(existing_emb, list)
        and len(existing_emb) == dimension
        and all(isinstance(x, (int, float)) and math.isfinite(x) for x in existing_emb)
        and max(abs(float(a) - float(b)) for a, b in zip(existing_emb, computed_emb)) <= 1e-4
    ):
        embedding = [float(x) for x in existing_emb]
    else:
        embedding = computed_emb

    if len(embedding) != dimension:
        raise ValueError(
            f"Embedding length {len(embedding)} does not match dimension {dimension}"
        )
    if not all(math.isfinite(x) for x in embedding):
        raise ValueError("Embedding contains non-finite values")

    # 7. Timestamps and status
    active = bool(raw.get("active", True))
    published = bool(raw.get("published", True))
    published_at = raw.get("published_at")
    if published and not published_at:
        published_at = datetime.now(timezone.utc).isoformat()

    return ClinicalDocument(
        source_type=raw_source_type,
        source_id=source_id,
        title=title,
        content=cleaned_content,
        metadata=metadata,
        embedding=embedding,
        embedding_model=model,
        embedding_dimension=dimension,
        embedding_provenance=provenance,
        content_hash=content_hash,
        sync_revision=int(raw.get("sync_revision", 1)),
        active=active,
        published=published,
        published_at=str(published_at) if published_at else None,
        deleted_at=raw.get("deleted_at"),
    )


# -----------------------------------------------------------------------------
# SQL Generation
# -----------------------------------------------------------------------------
def render_upsert_statement(doc: ClinicalDocument, table: str = DEFAULT_TABLE) -> str:
    """Render a single idempotent PostgreSQL INSERT ... ON CONFLICT DO UPDATE statement."""
    vec_literal = vector_literal(doc.embedding, dimension=doc.embedding_dimension)
    pub_at_sql = (
        f"{sql_literal(doc.published_at)}::timestamptz"
        if doc.published_at
        else "now()"
    )
    del_at_sql = (
        f"{sql_literal(doc.deleted_at)}::timestamptz"
        if doc.deleted_at
        else "NULL::timestamptz"
    )

    return f"""INSERT INTO {table} (
    source_type, source_id, title, content, metadata,
    embedding, embedding_model, embedding_dimension, embedding_provenance,
    content_hash, sync_revision, active, published, published_at, deleted_at
) VALUES (
    {sql_literal(doc.source_type)},
    {sql_literal(doc.source_id)},
    {sql_literal(doc.title)},
    {sql_literal(doc.content)},
    {jsonb_literal(doc.metadata)},
    {sql_literal(vec_literal)}::extensions.vector({doc.embedding_dimension}),
    {sql_literal(doc.embedding_model)},
    {doc.embedding_dimension},
    {sql_literal(doc.embedding_provenance)},
    {sql_literal(doc.content_hash)},
    {doc.sync_revision},
    {boolean_literal(doc.active)},
    {boolean_literal(doc.published)},
    {pub_at_sql},
    {del_at_sql}
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
    sync_revision = {table}.sync_revision + 1,
    active = EXCLUDED.active,
    published = EXCLUDED.published,
    published_at = EXCLUDED.published_at,
    deleted_at = EXCLUDED.deleted_at,
    updated_at = now();"""


def build_upsert_sql(doc: dict[str, Any] | ClinicalDocument, table: str = DEFAULT_TABLE) -> str:
    """Build upsert SQL for a document, accepting either dict or ClinicalDocument."""
    if isinstance(doc, dict):
        clinical_doc = validate_and_normalize_document(doc)
    else:
        clinical_doc = doc
    return render_upsert_statement(clinical_doc, table=table)


render_document_sql = build_upsert_sql


def render_full_sql_script(
    docs: list[ClinicalDocument],
    table: str = DEFAULT_TABLE,
    batch_size: int = 50,
) -> str:
    """Render a complete, self-contained, transactional SQL seed script."""
    lines: list[str] = [
        "-- ===========================================================================",
        "-- Seed Script: Authentic Clinical Knowledge Base (pgvector 384-dim)",
        f"-- Generated at: {datetime.now(timezone.utc).isoformat()}",
        f"-- Total documents: {len(docs)}",
        "-- Target table: " + table,
        "-- Mode: Idempotent UPSERT on (source_type, source_id)",
        "-- ===========================================================================",
        "BEGIN;",
        "",
    ]

    for i, doc in enumerate(docs, 1):
        lines.append(f"-- [{i}/{len(docs)}] {doc.source_type}:{doc.source_id} - {doc.title}")
        lines.append(render_upsert_statement(doc, table=table))
        lines.append("")

    lines.append("COMMIT;")
    lines.append("")
    return "\n".join(lines)


# -----------------------------------------------------------------------------
# Direct Database Execution
# -----------------------------------------------------------------------------
def execute_sql_direct(
    sql_script: str,
    db_url: str,
    psql_bin: str = "psql",
) -> None:
    """Execute SQL script directly against target PostgreSQL/Supabase database."""
    # Method 1: Try psycopg if available
    try:
        import psycopg  # type: ignore[import-untyped]

        print("Executing SQL script directly via psycopg...")
        with psycopg.connect(db_url, connect_timeout=15) as conn:
            with conn.cursor() as cur:
                cur.execute(sql_script)
            conn.commit()
        print("Database execution succeeded via psycopg.")
        return
    except ImportError:
        pass
    except Exception as exc:
        raise RuntimeError(f"psycopg execution failed: {exc}") from exc

    # Method 2: Fallback to psql command line
    print(f"psycopg not installed. Falling back to psql binary: {psql_bin}...")
    command = [
        psql_bin,
        "--no-psqlrc",
        "--dbname",
        db_url,
        "--set",
        "ON_ERROR_STOP=1",
    ]
    proc = subprocess.run(
        command,
        input=sql_script,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if proc.returncode != 0:
        redacted_err = re.sub(r"(postgres(?:ql)?://)[^\s]+", r"\1<redacted>", proc.stderr or proc.stdout)
        raise RuntimeError(f"psql execution failed (exit code {proc.returncode}): {redacted_err}")

    print("Database execution succeeded via psql.")


# -----------------------------------------------------------------------------
# CLI Parser & Main Pipeline
# -----------------------------------------------------------------------------
def build_parser() -> argparse.ArgumentParser:
    """Construct CLI argument parser."""
    parser = argparse.ArgumentParser(
        description="Ingest authentic clinical knowledge into Supabase pgvector table healthcare.ai_documents",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--input-file",
        type=Path,
        default=DEFAULT_INPUT_FILE,
        help="Path to JSON data file containing clinical records",
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=None,
        help="Path to directory containing Markdown articles with optional frontmatter",
    )
    parser.add_argument(
        "--output-sql",
        type=Path,
        default=DEFAULT_OUTPUT_SQL,
        help="Path to output idempotent SQL seed file",
    )
    parser.add_argument(
        "--db-url",
        type=str,
        default=None,
        help="PostgreSQL connection string (defaults to SUPABASE_DB_URL or DATABASE_URL)",
    )
    parser.add_argument(
        "--table",
        type=str,
        default=DEFAULT_TABLE,
        help="Target PostgreSQL table name",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=DEFAULT_MODEL,
        help="Embedding model label recorded in database",
    )
    parser.add_argument(
        "--provenance",
        type=str,
        default=DEFAULT_PROVENANCE,
        choices=sorted(ALLOWED_PROVENANCES),
        help="Embedding provenance recorded in database",
    )
    parser.add_argument(
        "--dimension",
        type=int,
        default=EMBEDDING_DIMENSION,
        help="Vector dimension (must be 384 for healthcare.ai_documents)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Batch size for SQL transaction grouping",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate all documents, hashes, embeddings, and constraints without writing database changes",
    )
    parser.add_argument(
        "--psql-bin",
        type=str,
        default="psql",
        help="Path to psql binary for command-line database execution fallback",
    )
    return parser


def run_ingest(args: argparse.Namespace) -> int:
    """Execute the complete ingestion pipeline."""
    if args.dimension != EMBEDDING_DIMENSION:
        raise ValueError(
            f"Table {args.table} strictly enforces embedding_dimension = {EMBEDDING_DIMENSION}. "
            f"Requested {args.dimension} is invalid."
        )

    raw_docs: list[dict[str, Any]] = []

    # 1. Load from JSON if specified and exists
    if args.input_file and args.input_file.exists():
        print(f"Loading clinical records from JSON: {args.input_file}")
        loaded = load_documents_from_json(args.input_file)
        print(f"  Loaded {len(loaded)} raw records from JSON.")
        raw_docs.extend(loaded)
    elif args.input_file and not args.input_dir:
        print(f"Error: Input JSON file not found: {args.input_file}", file=sys.stderr)
        return 1

    # 2. Load from Markdown directory if specified
    if args.input_dir:
        if args.input_dir.exists() and args.input_dir.is_dir():
            print(f"Loading markdown articles from directory: {args.input_dir}")
            loaded_md = load_documents_from_markdown_dir(args.input_dir)
            print(f"  Loaded {len(loaded_md)} markdown files.")
            raw_docs.extend(loaded_md)
        else:
            print(f"Error: Input markdown directory not found: {args.input_dir}", file=sys.stderr)
            return 1

    if not raw_docs:
        print(
            "Error: No clinical documents found. Provide a valid --input-file or --input-dir.",
            file=sys.stderr,
        )
        return 1

    # 3. Deduplicate and Validate
    print(f"Normalizing and validating {len(raw_docs)} clinical documents...")
    dedup_map: dict[tuple[str, str], ClinicalDocument] = {}
    type_counts: dict[str, int] = {}

    for idx, raw in enumerate(raw_docs, 1):
        try:
            doc = validate_and_normalize_document(
                raw,
                model=args.model,
                provenance=args.provenance,
                dimension=args.dimension,
            )
        except Exception as exc:
            print(
                f"Error validating document #{idx} ({raw.get('source_type')}:{raw.get('source_id')}): {exc}",
                file=sys.stderr,
            )
            return 1

        key = (doc.source_type, doc.source_id)
        if key in dedup_map:
            print(f"  Notice: Duplicate key {key} overwritten by subsequent occurrence.")
        dedup_map[key] = doc

    docs = list(dedup_map.values())
    for doc in docs:
        type_counts[doc.source_type] = type_counts.get(doc.source_type, 0) + 1

    # 4. Print Summary
    print("\n--- Ingestion Document Summary ---")
    print(f"Total Unique Documents: {len(docs)}")
    for stype in sorted(type_counts):
        print(f"  - {stype:<12}: {type_counts[stype]} records")
    print("----------------------------------\n")

    # Determine if output-sql was explicitly requested on the command line
    explicit_output_sql = any(
        arg == "--output-sql" or arg.startswith("--output-sql=")
        for arg in sys.argv
    )

    # 5. Handle Dry Run vs Normal Run
    if args.dry_run:
        # If user explicitly requested --output-sql alongside --dry-run (e.g. in test suites), write SQL file
        if explicit_output_sql and args.output_sql:
            sql_script = render_full_sql_script(
                docs,
                table=args.table,
                batch_size=args.batch_size,
            )
            args.output_sql.parent.mkdir(parents=True, exist_ok=True)
            args.output_sql.write_text(sql_script, encoding="utf-8")
            print(
                f"Generated idempotent SQL script: {args.output_sql} "
                f"({len(sql_script.encode('utf-8')):,} bytes, {len(docs)} records)."
            )

        print(
            f"[DRY-RUN SUCCESS] All {len(docs)} documents passed validation, embeddings (384-dim), "
            "and SHA-256 hash checks with 0 errors. No database changes were written."
        )
        return 0

    # 6. Render and Write SQL Output
    sql_script = render_full_sql_script(
        docs,
        table=args.table,
        batch_size=args.batch_size,
    )

    if args.output_sql:
        args.output_sql.parent.mkdir(parents=True, exist_ok=True)
        args.output_sql.write_text(sql_script, encoding="utf-8")
        print(
            f"Generated idempotent SQL script: {args.output_sql} "
            f"({len(sql_script.encode('utf-8')):,} bytes, {len(docs)} records)."
        )

    # 7. Execute Database Ingestion if Requested
    db_url = args.db_url or os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")
    if db_url:
        print("Database connection string detected. Initiating direct database upsert...")
        try:
            execute_sql_direct(sql_script, db_url=db_url, psql_bin=args.psql_bin)
            print(f"Successfully ingested {len(docs)} clinical records into {args.table}!")
        except Exception as exc:
            print(f"Database execution error: {exc}", file=sys.stderr)
            return 1
    else:
        print("No --db-url or SUPABASE_DB_URL specified. SQL generation complete.")

    return 0


def main() -> None:
    """CLI entry point."""
    parser = build_parser()
    args = parser.parse_args()
    try:
        sys.exit(run_ingest(args))
    except Exception as exc:
        print(f"Fatal error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
