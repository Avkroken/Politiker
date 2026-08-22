#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Delade hjälpfunktioner för parti-, roll- och mailto-hantering."""
from __future__ import annotations

import re

PARTY_FULLNAME_TO_ABBR = {
    "socialdemokraterna": "S",
    "moderaterna": "M",
    "moderata samlingspartiet": "M",
    "sverigedemokraterna": "SD",
    "vänsterpartiet": "V",
    "centerpartiet": "C",
    "liberalerna": "L",
    "kristdemokraterna": "KD",
    "miljöpartiet": "MP",
    "miljöpartiet de gröna": "MP",
    "feministiskt initiativ": "FI",
}

_INVALID_PARTY = {"", "-", "--", "oberoende", "partilös", "partilos"}


def normalize_party(raw: str | None) -> str | None:
    """Normalisera parti utan att göra status-/historiktext till partinamn."""
    if not raw:
        return None
    value = re.sub(r"\s+", " ", raw).strip().strip(",;")
    low = value.lower()
    if low in _INVALID_PARTY:
        return None
    if re.search(r"(?:^|[,;\s-])fd\.?\s+", low):
        return None
    value = PARTY_FULLNAME_TO_ABBR.get(low, value)
    return value or None


def normalize_role(raw: str | None) -> str | None:
    """Behåll bara roller som är relevanta för mottagarfiltrering.

    Källregistren innehåller även uppdrag som god man, ombud, revisor,
    nämndeman och vigselförrättare. De är giltiga källdata men ska inte bli
    primär politisk befattning i Politikerkontakt.
    """
    if not raw:
        return None
    value = re.sub(r"\s+", " ", raw).strip()
    low = value.lower()
    if "gruppledare" in low:
        return "Gruppledare"
    if "ordf" in low or re.fullmatch(r"\d+\s*[:.]?\s*[ae]?\s*vice", low):
        return "Ordförande"
    if "ledamot" in low or "ledamöter" in low or low == "led":
        return "Ledamot"
    if "ersätt" in low or "supple" in low or low == "ers":
        return "Ersättare"
    return None


def party_from_parens(text: str) -> str | None:
    m = re.search(r"\(([^)]{1,40})\)\s*$", text.strip())
    return normalize_party(m.group(1)) if m else None


def party_anywhere(text: str) -> str | None:
    m = re.search(r"\(([^)]{1,40})\)", text)
    return normalize_party(m.group(1)) if m else None
