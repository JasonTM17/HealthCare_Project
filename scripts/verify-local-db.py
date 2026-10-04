import psycopg
import sys

def verify():
    print("=== PostgreSQL Connection Verification ===")
    try:
        conn = psycopg.connect(
            host="127.0.0.1",
            port=5434,
            user="healthcare",
            password="change-me",
            dbname="healthcare",
            connect_timeout=5
        )
    except Exception as e:
        print(f"[FAIL] Could not connect to PostgreSQL on 127.0.0.1:5434: {e}")
        sys.exit(1)

    cur = conn.cursor()
    cur.execute("SELECT version();")
    print("PostgreSQL Version:", cur.fetchone()[0])
    cur.execute("SELECT current_database(), current_user;")
    db, user = cur.fetchone()
    print(f"Database: {db}, User: {user}")

    cur.execute("""
        SELECT count(*)
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    """)
    table_count = cur.fetchone()[0]
    print(f"Total base tables in public schema: {table_count}")

    tables_to_check = [
        "users", "roles", "user_roles", "branches", "specialties",
        "doctors", "doctor_schedules", "appointments", "medical_records",
        "prescriptions", "patient_documents", "cms_contents", "articles"
    ]

    print("\n=== Key Table Record Counts ===")
    for t in tables_to_check:
        cur.execute(f"SELECT count(*) FROM {t}")
        cnt = cur.fetchone()[0]
        print(f"  {t:30}: {cnt} records")

    cur.execute("SELECT count(*) FROM flyway_schema_history WHERE success = true;")
    flyway_count = cur.fetchone()[0]
    print(f"\nFlyway migrations successfully applied: {flyway_count}")

    conn.close()
    print("\n[SUCCESS] Local Docker PostgreSQL is fully operational and verified!")

if __name__ == "__main__":
    verify()
