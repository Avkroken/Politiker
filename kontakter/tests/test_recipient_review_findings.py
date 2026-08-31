from pathlib import Path
import importlib.util
import sys

ROOT = Path(__file__).resolve().parents[1]
SCRAPER = ROOT / "scraper"
sys.path.insert(0, str(SCRAPER))


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


fetch_media = load("fetch_media_review", SCRAPER / "fetch_media.py")
fetch_eu_meps = load("fetch_eu_meps_review", SCRAPER / "fetch_eu_meps.py")


def test_media_scraper_rejects_placeholder_and_customer_service():
    assert not fetch_media.is_editorial_email("rnamn.efternamn@aftonbladet.se")
    assert not fetch_media.is_editorial_email("fornamn.efternamn@aftonbladet.se")
    assert not fetch_media.is_editorial_email("kundservice@expressen.se")
    assert fetch_media.is_editorial_email("anna.andersson@expressen.se")


def test_current_mep_upsert_clears_dead_status():
    assert "verification_status = NULL" in fetch_eu_meps.UPSERT_SQL
