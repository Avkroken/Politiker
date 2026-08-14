import pytest

import sync_to_d1 as s


def test_area_type_for():
    assert s.area_type_for("Region Skåne") == "region"
    assert s.area_type_for("Sveriges riksdag") == "riksdag"
    assert s.area_type_for("Justitiedepartementet") == "regering"
    assert s.area_type_for("Regeringen") == "regering"
    assert s.area_type_for("Lysekils kommun") == "kommun"


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
