import politiker_common as pc


def test_normalize_party_fullname_to_abbr():
    assert pc.normalize_party("Socialdemokraterna") == "S"
    assert pc.normalize_party("moderata samlingspartiet") == "M"
    assert pc.normalize_party("Miljöpartiet de gröna") == "MP"


def test_normalize_party_passthrough_and_none():
    assert pc.normalize_party("SD") == "SD"        # redan förkortning
    assert pc.normalize_party("Lokalt Parti") == "Lokalt Parti"
    assert pc.normalize_party(None) is None
    assert pc.normalize_party("   ") is None


def test_party_from_parens_only_at_end():
    assert pc.party_from_parens("David Johansson (C)") == "C"
    # parti inte sist -> from_parens ska INTE plocka det
    assert pc.party_from_parens("Anna (S), ordförande") is None


def test_party_anywhere():
    assert pc.party_anywhere("Anna (S), ordförande") == "S"
    assert pc.party_anywhere("Bo Ek (Socialdemokraterna) vice") == "S"
    assert pc.party_anywhere("Inget parti här") is None
