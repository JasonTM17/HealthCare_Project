"""Find child tables missing from AbstractIntegrationTest#cleanDatabase.

The integration cleanup grew table by table; V86/V87 seeded rows in tables it
never learned about, so appointment/patient deletes fail on foreign keys once
the fresh-database migration chain passes. This script lists every child table
that references the main parent tables and is not mentioned in the cleanup.

Run:  python scripts/find-missing-cleanup-tables.py
"""
import io
import os
import re
import subprocess
import sys

BASE_TEST = "apps/backend/src/test/java/com/healthcare/AbstractIntegrationTest.java"
PARENTS = (
    "patient_profiles", "users", "doctors", "branches", "specialties",
    "appointments", "articles", "faqs", "packages", "services", "cms_contents",
)
PSQL = os.path.join(os.environ.get("ProgramFiles", "C:\\Program Files"),
                    "PostgreSQL", "bin", "psql.exe")


def psql_bin():
    candidates = [PSQL, r"C:\Users\Admin\scoop\apps\postgresql\current\bin\psql.exe", "psql"]
    for candidate in candidates:
        if candidate == "psql" or os.path.exists(candidate):
            return candidate
    raise SystemExit("psql not found")


def table_for_repository(repo):
    name = repo.replace("Repository", "")
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower() + "s"


def main():
    source = io.open(BASE_TEST, encoding="utf-8").read()
    mentioned = {table_for_repository(m) for m in re.findall(r"[A-Za-z]+Repository\.(deleteAll|deleteAllInBatch)?", source) if m}
    mentioned |= set(re.findall(r"\b(?:TRUNCATE TABLE|DELETE FROM)\s+([a-z_]+)", source))
    for line in source.splitlines():
        stripped = line.strip().rstrip(",")
        if re.fullmatch(r"[a-z_]{3,}", stripped):
            mentioned.add(stripped)
    mentioned |= {"cms_contents", "cms_content_changes"}

    parents = ", ".join(f"'{p}'" for p in PARENTS)
    query = (
        "SELECT ccu.table_name || '|' || tc.table_name "
        "FROM information_schema.table_constraints tc "
        "JOIN information_schema.constraint_column_usage ccu "
        "  ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema "
        "WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public' "
        f"  AND ccu.table_name IN ({parents});"
    )
    result = subprocess.run(
        [psql_bin(), "-h", "127.0.0.1", "-U", "healthcare", "-d", "healthcare", "-tAc", query],
        capture_output=True, text=True,
        env={**os.environ, "PGPASSWORD": os.environ.get("HEALTHCARE_DB_PASSWORD", "change-me")},
    )
    if result.returncode != 0:
        print(result.stderr.strip())
        return 2

    child_of = {}
    for line in result.stdout.splitlines():
        if "|" in line:
            parent, child = line.split("|", 1)
            child_of.setdefault(child.strip(), set()).add(parent.strip())

    missing = {child: parents for child, parents in sorted(child_of.items()) if child not in mentioned}
    if not missing:
        print("cleanup covers every child table")
        return 0
    for child, parents in missing.items():
        print(f"MISSING cleanup: {child}  (references {', '.join(sorted(parents))})")
    return 1


if __name__ == "__main__":
    sys.exit(main())
