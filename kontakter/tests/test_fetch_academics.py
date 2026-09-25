from pathlib import Path
import importlib.util
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
