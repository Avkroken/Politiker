#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Delade hjälpfunktioner för parti- och mailto-hantering.

Samma logik behövdes i både scraper.py (Playwright) och de requests-baserade
backfill-skripten; den bor här i en kopia så att de inte driver isär.
"""
from __future__ import annotations

import re

# Fullständiga partinamn -> standardförkortning, så parti-fältet blir
# konsekvent oavsett källa (troman/mailto visar redan förkortning,
# netpublicator visar fullständigt namn).
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


def normalize_party(raw: str | None) -> str | None:
    if not raw:
        return None
    raw = raw.strip()
    return PARTY_FULLNAME_TO_ABBR.get(raw.lower(), raw) or None


def party_from_parens(text: str) -> str | None:
    """Plockar ut '(PARTI)' i slutet av en textsträng, t.ex.
    'David Johansson (C)' -> 'C'. Används där partiet alltid är det sista
    (rubriker/titlar utan efterföljande roll-text)."""
    m = re.search(r"\(([^)]{1,20})\)\s*$", text.strip())
    return normalize_party(m.group(1)) if m else None


def party_anywhere(text: str) -> str | None:
    """Plockar ut '(PARTI)' var som helst i texten, t.ex.
    'David Johansson (C), ordförande' -> 'C'. Används där en roll kan
    följa partiet i samma sträng (parti är då INTE sist)."""
    m = re.search(r"\(([^)]{1,20})\)", text)
    return normalize_party(m.group(1)) if m else None
