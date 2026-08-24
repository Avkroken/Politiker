from pathlib import Path
import importlib.util
import sys

ROOT = Path(__file__).resolve().parents[1]
SCRAPER = ROOT / "scraper"
EXPORT = ROOT / "export"
sys.path.insert(0, str(SCRAPER))


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


export_d1 = load("export_d1_review", EXPORT / "export_d1.py")
fetch_media = load("fetch_media_review", SCRAPER / "fetch_media.py")
fetch_eu_meps = load("fetch_eu_meps_review", SCRAPER / "fetch_eu_meps.py")


def test_recipient_meta_collapses_canonical_role_variants():
    rows = [
        {"area_type": "kommun", "area_name": "X", "party": "S", "role": "Ledamot"},
        {"area_type": "kommun", "area_name": "X", "party": "S", "role": "LEDAMOT"},
        {"area_type": "kommun", "area_name": "X", "party": "S", "role": "Suppleant"},
    ]
    meta = export_d1.recipient_meta(rows)
    by_key = {r["role_key"]: r for r in meta["roles"]}
    assert by_key["ledamot"]["count"] == 2
    assert by_key["ledamot"]["role"] == "Ledamot"
    assert by_key["ersättare"]["count"] == 1


def test_export_rejects_foreign_meps_and_irrelevant_local_roles():
    assert export_d1.is_publishable_row({"area_type": "eu", "area_name": "Europaparlamentet (Sverige)", "role": "Ledamot"})
    assert not export_d1.is_publishable_row({"area_type": "eu", "area_name": "European Parliament (France)", "role": "Ledamot"})
    assert not export_d1.is_publishable_row({"area_type": "kommun", "area_name": "X", "role": "Nämndeman"})
    assert not export_d1.is_publishable_row({"area_type": "region", "area_name": "Y", "role": "Gode män"})
    assert export_d1.is_publishable_row({"area_type": "kommun", "area_name": "X", "role": "Ledamot"})


def test_media_scraper_rejects_placeholder_and_customer_service():
    assert not fetch_media.is_editorial_email("rnamn.efternamn@aftonbladet.se")
    assert not fetch_media.is_editorial_email("fornamn.efternamn@aftonbladet.se")
    assert not fetch_media.is_editorial_email("kundservice@expressen.se")
    assert fetch_media.is_editorial_email("anna.andersson@expressen.se")


def test_current_mep_upsert_clears_dead_status():
    assert "verification_status = NULL" in fetch_eu_meps.UPSERT_SQL
