import pytest

# scraper.py importerar playwright/pypdf; hoppa över lokalt om de saknas.
pytest.importorskip("playwright")
pytest.importorskip("pypdf")
import scraper as sc


def test_is_valid_email():
    assert sc.is_valid_email("anna.ek@lysekil.se")
    assert not sc.is_valid_email("noreply@lysekil.se")   # SKIP_KEYWORDS
    assert not sc.is_valid_email("info@region.se")       # "info@region"
    assert not sc.is_valid_email("inte en adress")


def test_email_from_mailto_href():
    assert sc.email_from_mailto_href("mailto:Anna@Lysekil.se") == "anna@lysekil.se"
    # url-kodat inledande blanksteg ska strippas
    assert sc.email_from_mailto_href("mailto:%20a@b.se?subject=x") == "a@b.se"


def test_email_local_part_translitteration():
    assert sc._email_local_part("Åsa") == "asa"
    assert sc._email_local_part("Görel") == "gorel"   # å/ä/ö -> a/a/o
    assert sc._email_local_part("André") == "andre"   # é -> e
    assert sc._email_local_part("Per-Erik") == "per-erik"  # bindestreck bevaras


def test_swedish_key_orders_after_z():
    names = ["Öberg", "Andersson", "Ähtävä", "Åberg", "Zetterlund"]
    assert sorted(names, key=sc.swedish_key) == [
        "Andersson", "Zetterlund", "Åberg", "Ähtävä", "Öberg",
    ]


def test_looks_like_name():
    assert sc._looks_like_name("Anna Ek")
    assert not sc._looks_like_name("a@b.se")
    assert not sc._looks_like_name("")
