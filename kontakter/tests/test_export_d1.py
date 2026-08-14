import export_d1 as e


def test_sqlesc_quotes_and_null():
    assert e.sqlesc(None) == "NULL"
    assert e.sqlesc("") == "NULL"
    assert e.sqlesc("Anna") == "'Anna'"
    # enkelfnutt escapas genom fördubbling
    assert e.sqlesc("O'Brien") == "'O''Brien'"


def test_sqlesc_numbers():
    assert e.sqlesc(0) == "'0'"
    assert e.sqlesc(42) == "'42'"
