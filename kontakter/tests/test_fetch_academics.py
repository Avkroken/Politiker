from pathlib import Path
import importlib.util
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
SCRAPER = ROOT / "scraper"
sys.path.insert(0, str(SCRAPER))


def load_module():
    path = SCRAPER / "fetch_academics.py"
    spec = importlib.util.spec_from_file_location("fetch_academics_test", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


academics = load_module()


def test_academic_registry_covers_all_core_fields():
    rows = academics.validated_contacts()
    assert len(rows) >= 20
    assert {row.academic_field for row in rows} == {
        academics.POLITICAL_SCIENCE,
        academics.PUBLIC_ADMINISTRATION,
        academics.PUBLIC_LAW,
    }


def test_academic_registry_uses_only_public_university_work_addresses():
    rows = academics.validated_contacts()
    assert len({(row.email, row.organisation) for row in rows}) == len(rows)
    for row in rows:
        assert row.email == row.email.lower()
        assert row.email.rsplit("@", 1)[1] in academics.ALLOWED_EMAIL_DOMAINS
        assert row.source_url.startswith("https://")
        assert row.organisation.endswith("universitet")


def test_academic_upsert_targets_general_public_contact_registry():
    assert "INSERT INTO public_contacts" in academics.UPSERT_SQL
    assert "'academia'" in academics.UPSERT_SQL
    assert "academic_field" in academics.UPSERT_SQL
    assert "source_url" in academics.UPSERT_SQL


def test_academic_sql_export_is_idempotent_and_sqlite_valid(tmp_path):
    rows = academics.validated_contacts()
    sql_path = tmp_path / "academics.sql"
    academics.write_sql_file(sql_path, rows, 123456789)
    sql = sql_path.read_text(encoding="utf-8")

    assert sql.startswith("BEGIN;\n")
    assert sql.endswith("COMMIT;\n")
    assert sql.count("INSERT INTO public_contacts") == len(rows)

    db = sqlite3.connect(":memory:")
    db.execute(
        """
        CREATE TABLE public_contacts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          area_name TEXT NOT NULL,
          area_type TEXT NOT NULL,
          party TEXT,
          role TEXT,
          last_scraped_at INTEGER NOT NULL,
          organisation TEXT,
          unit TEXT,
          title TEXT,
          academic_field TEXT,
          source_url TEXT,
          UNIQUE(email, area_name)
        )
        """
    )
    db.executescript(sql)
    db.executescript(sql)

    count = db.execute("SELECT COUNT(*) FROM public_contacts WHERE area_type='academia'").fetchone()[0]
    fields = db.execute("SELECT COUNT(DISTINCT academic_field) FROM public_contacts WHERE area_type='academia'").fetchone()[0]
    assert count == len(rows)
    assert fields == 3


def test_sql_literal_escapes_apostrophes_without_guessing():
    assert academics.sql_literal("O'Brien") == "'O''Brien'"
