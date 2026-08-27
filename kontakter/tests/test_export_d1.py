import export_d1 as e


def test_write_outputs_uses_strong_hash_for_recipient_id(tmp_path):
    row = {
        "name": "Anna Andersson",
        "email": "anna@example.se",
        "area_name": "Exempel kommun",
        "area_type": "kommun",
        "party": "Exempelpartiet",
        "role": "Ledamot",
    }

    e.write_outputs([row], str(tmp_path))

    sql = (tmp_path / "politiker.sql").read_text(encoding="utf-8")
    expected_id = e.hashlib.sha256(b"anna@example.se|Exempel kommun").hexdigest()
    assert f"VALUES ('{expected_id}'" in sql


def test_sqlesc_quotes_and_null():
    assert e.sqlesc(None) == "NULL"
    assert e.sqlesc("") == "NULL"
    assert e.sqlesc("Anna") == "'Anna'"
    # enkelfnutt escapas genom fördubbling
    assert e.sqlesc("O'Brien") == "'O''Brien'"


def test_sqlesc_numbers():
    assert e.sqlesc(0) == "'0'"
    assert e.sqlesc(42) == "'42'"
