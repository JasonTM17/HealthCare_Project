"""Analyze the V86/V87 appointment references against the test fixture.

Reports which (doctor_id, branch_id) pairs and catalog rows the migrations
reference but the fixture (and the migration chain itself) does not create.
Run with:  python scripts/analyze-migration-fixture.py [--fix]

--fix rewrites the doctor_branches section of the fixture for pairs whose
doctor already exists before V86 (i.e. created by an earlier migration); pairs
whose doctor is created BY V86/V87 are reported as late and must be handled in
the migration itself, not the pre-V86 fixture.
"""
import io
import re
import sys

MIGRATIONS = "apps/backend/src/main/resources/db/migration"
FIXTURE = "apps/backend/src/main/resources/db/catalog/v86-catalog-prerequisites.sql"
UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"


def read(path):
    return io.open(path, encoding="utf-8").read()


def created_ids(text, table):
    ids = set()
    pattern = (
        r"INSERT INTO " + table + r" \([^)]*\)\s*(?:VALUES|SELECT)([\s\S]{0,20000}?)"
        r"(?:ON CONFLICT|;)\s*"
    )
    for match in re.finditer(pattern, text):
        ids.update(re.findall(r"'(" + UUID + r")'", match.group(1)))
    return ids


def referenced_pairs(text):
    out = set()
    # V86 puts both the column list and ON CONFLICT on their own lines, V87
    # keeps them inline, so both separators must tolerate whitespace (\s*)
    # or half the references vanish.
    for match in re.finditer(
        r"INSERT INTO appointments \(([^)]*)\)\s*VALUES\s*\(([^;]*?)\)\s*ON CONFLICT", text, re.S
    ):
        cols = [c.strip() for c in match.group(1).split(",")]
        parts, cur, quoted = [], "", False
        for ch in match.group(2):
            if ch == "'":
                quoted = not quoted
            if ch == "," and not quoted:
                parts.append(cur)
                cur = ""
            else:
                cur += ch
        parts.append(cur)
        if len(parts) != len(cols):
            continue
        row = dict(zip(cols, [p.strip().strip("'") for p in parts]))
        doctor, branch = row.get("doctor_id", ""), row.get("branch_id", "")
        if re.match("^" + UUID + "$", doctor) and re.match("^" + UUID + "$", branch):
            out.add((doctor, branch))
    return out


def main():
    v86 = read(f"{MIGRATIONS}/V86__seed_comprehensive_clinical_tables_and_empty_tables.sql")
    v87 = read(f"{MIGRATIONS}/V87__enrich_clinical_enterprise_big_data.sql")
    fixture = read(FIXTURE)
    pairs = set(re.findall(r"WHERE doctor_id='(" + UUID + r")' AND branch_id='(" + UUID + r")'", fixture))

    created_late = created_ids(v86, "doctors") | created_ids(v87, "doctors")
    need = referenced_pairs(v86) | referenced_pairs(v87)

    missing = need - pairs
    late = {p for p in missing if p[0] in created_late}
    seedable = missing - late

    print(f"pairs in fixture: {len(pairs)}")
    print(f"pairs referenced by V86/V87: {len(need)}")
    print(f"missing from fixture: {len(missing)} (seedable before V86: {len(seedable)}, late: {len(late)})")
    for doctor, branch in sorted(late):
        print(f"  LATE (doctor created by V86/V87): {doctor} / {branch}")
    for doctor, branch in sorted(seedable)[:10]:
        print(f"  MISSING: {doctor} / {branch}")

    if "--fix" in sys.argv and seedable:
        lines = [l for l in fixture.splitlines() if not l.startswith("INSERT INTO doctor_branches")]
        lines.append("")
        for doctor, branch in sorted(seedable):
            lines.append(
                "INSERT INTO doctor_branches (id, doctor_id, branch_id) "
                f"SELECT md5('fixture:{doctor}:{branch}')::uuid, '{doctor}', '{branch}' "
                "WHERE NOT EXISTS (SELECT 1 FROM doctor_branches "
                f"WHERE doctor_id = '{doctor}' AND branch_id = '{branch}');"
            )
        io.open(FIXTURE, "w", encoding="utf-8").write("\n".join(lines) + "\n")
        print(f"--fix: fixture rewritten with {len(seedable)} seedable pairs")
    elif "--fix" in sys.argv:
        print("--fix: nothing seedable to add")

    return 1 if late else 0


if __name__ == "__main__":
    sys.exit(main())
