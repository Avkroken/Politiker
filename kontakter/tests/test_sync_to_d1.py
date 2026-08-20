import pytest

import sync_to_d1 as s


def test_area_type_for():
    assert s.area_type_for("Region Skåne") == "region"
    assert s.area_type_for("Sveriges riksdag") == "riksdag"
    assert s.area_type_for("Justitiedepartementet") == "regering"
    assert s.area_type_for("Regeringen") == "regering"
    assert s.area_type_for("Lysekils kommun") == "kommun"


def test_vastra_gotalandsregionen_is_a_region_despite_its_name():
    """Regressionen som faktiskt inträffade.

    Den gamla regeln var `startswith("Region ")`, och VGR är den enda av
    Sveriges 21 regioner vars namn inte börjar så. 497 ledamöter låg
    därför som "kommun" i produktion — osynliga för den som filtrerade på
    region, och en region mitt i kommunlistan. Det gamla testet hade
    "Region Skåne", alltså just ett av de tjugo namn regeln råkade klara.
    """
    assert s.area_type_for("Västra Götalandsregionen") == "region"


def test_every_configured_region_classifies_as_a_region():
    """Kontraktet, inte stickprovet.

    Skrapans egen källista är facit: varje regionpost i `regioner.json`
    ska klassas som region. Utan det här kan listan växa med ett namn som
    inte passar mönstret, precis som VGR gjorde, utan att något säger
    ifrån.
    """
    for name in sorted(s.REGION_NAMES):
        assert s.area_type_for(name) == "region", name
    assert len(s.REGION_NAMES) == 21, "Sverige har 21 regioner"


def test_parse_csv(tmp_path):
    csv_path = tmp_path / "resultat.csv"
    csv_path.write_text(
        "area_name,name,email,party,role,source\n"
        "Lysekils kommun,Anna Ek,anna@lysekil.se,S,Ordförande,scraped\n"
        "Lysekils kommun,,info@lysekil.se,,,scraped\n"
        "Region Skåne,Bo Vik,bo@skane.se,,,pattern-guess\n",
        encoding="utf-8",
    )
    rows = s.parse_csv(str(csv_path))
    assert ("Anna Ek", "anna@lysekil.se", "Lysekils kommun", "kommun", "S", "Ordförande") in rows
    # tomt namn/party/role -> "" resp. None
    assert ("", "info@lysekil.se", "Lysekils kommun", "kommun", None, None) in rows
    assert ("Bo Vik", "bo@skane.se", "Region Skåne", "region", None, None) in rows


def test_load_rows_reads_csv(tmp_path, monkeypatch):
    csv_path = tmp_path / "r.csv"
    csv_path.write_text("area_name,name,email,party,role,source\nX kommun,A B,a@x.se,,,scraped\n", encoding="utf-8")
    monkeypatch.setattr(s, "RESULTAT_CSV", str(csv_path))
    rows = s.load_rows()
    assert rows == [("A B", "a@x.se", "X kommun", "kommun", None, None)]


def test_load_rows_exits_when_csv_missing(tmp_path, monkeypatch):
    monkeypatch.setattr(s, "RESULTAT_CSV", str(tmp_path / "missing.csv"))
    with pytest.raises(SystemExit):
        s.load_rows()
