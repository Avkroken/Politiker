#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Delade hjälpfunktioner för parti-, roll- och mailto-hantering."""
from __future__ import annotations

import re

PARTY_ALIASES = {
    # Riksdagspartier och vanliga fullständiga namn.
    "s": "S",
    "socialdemokraterna": "S",
    "socialdemokratiska arbetarepartiet": "S",
    "m": "M",
    "moderaterna": "M",
    "moderata samlingspartiet": "M",
    "sd": "SD",
    "sverigedemokraterna": "SD",
    "v": "V",
    "vänsterpartiet": "V",
    "c": "C",
    "centerpartiet": "C",
    "l": "L",
    "liberalerna": "L",
    "folkpartiet liberalerna": "L",
    "kd": "KD",
    "kristdemokraterna": "KD",
    "mp": "MP",
    "miljöpartiet": "MP",
    "miljöpartiet de gröna": "MP",
    "fi": "FI",
    "feministiskt initiativ": "FI",
    "medborgerlig samling": "MED",
    "med": "MED",
    # Europaparlamentets grupper. Dessa är inte svenska partier, men är
    # legitima gruppvärden för EU-mottagare och får därför en stabil stavning.
    "ecr": "ECR",
    "esn": "ESN",
    "ppe": "PPE",
    "renew": "Renew",
    "s&d": "S&D",
    "the left": "The Left",
    "verts/ale": "Verts/ALE",
}

_INVALID_PARTY = {
    "",
    "-",
    "--",
    "saknas",
    "oberoende",
    "ober",
    "opol",
    "opol.",
    "partilös",
    "partilos",
    "utan partitillhörighet",
    "parti saknas",
}


def normalize_party(raw: str | None) -> str | None:
    """Normalisera parti/grupp utan att göra status-/historiktext till partinamn.

    Kända partier och EU-grupper får ett kanoniskt värde. Korta okända
    bokstavsförkortningar normaliseras till versaler så att t.ex. ``SiV`` och
    ``SIV`` inte skapar två filteralternativ. Fullständiga lokala partinamn
    lämnas i övrigt orörda.
    """
    if not raw:
        return None
    value = re.sub(r"\s+", " ", raw).strip().strip(",;")
    low = value.casefold()
    if low in _INVALID_PARTY:
        return None
    if re.search(r"(?:^|[,;\s-])fd\.?\s+", low):
        return None
    if low in PARTY_ALIASES:
        return PARTY_ALIASES[low]
    if re.fullmatch(r"[A-Za-zÅÄÖåäö]{1,4}", value):
        return value.upper()
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
