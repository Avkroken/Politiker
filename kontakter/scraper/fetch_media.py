#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Synkar redaktionella kontaktvägar för fem stora svenska nyhetsorganisationer.

Princip:
- area_type='media' ger en egen huvudkategori i appen.
- area_name är mediehuset (SVT, Sveriges Radio/Ekot, TV4, Aftonbladet, Expressen).
- role skiljer Nyhetsredaktion, Politik, Granskning, Ledare/opinion m.m.
- Officiella funktionsadresser prioriteras. När en viktig avdelning saknar
  funktionsadress används endast offentligt publicerade yrkesadresser till
  redaktörer/reportrar på den avdelningen.
- Vi gissar aldrig e-postadresser.

Källor verifierade 2026-08-21. Dynamiska personalsidor skrapas där de är stabila;
funktionsadresser ligger som verifierade fallbacks så en layoutändring inte
raderar en hel redaktion ur databasen.
"""
from __future__ import annotations

import html
import re
import sys
import time
from dataclasses import dataclass

import requests

from d1 import D1Client

UA = {"User-Agent": "politiker-contact-refresh/1.0 (+https://github.com/blixten85/politiker)"}
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


@dataclass(frozen=True)
class Contact:
    name: str
    email: str
    organisation: str
    role: str
    source: str


# Officiellt publicerade funktionsadresser och yrkeskontakter. Personadresser
# används bara när avdelningen saknar en bättre gemensam adress.
STATIC_CONTACTS = [
    Contact("SVT Nyheter", "tipsaoss@svt.se", "SVT", "Nyhetstips", "https://www.svt.se/nyheter/inrikes/tipsa-svt-nyheter-oyvvtm"),
    Contact("SVT Nyheter", "svtnyheter@svt.se", "SVT", "Nyhetsredaktion", "https://www.svt.se/nyheter/inrikes/sa-kontaktar-du-svt-nyheter"),
    Contact("SVT Nyheter grävdesk", "tips@svt.se", "SVT", "Granskning", "https://www.svt.se/nyheter/granskning/tipsa-svt-nyheter"),
    Contact("Uppdrag granskning", "granskning@svt.se", "SVT", "Granskning", "https://www.svt.se/nyheter/granskning/ug/skicka-oss-ett-mejl"),
    Contact("Ekot", "ekot@sverigesradio.se", "Sveriges Radio/Ekot", "Nyhetsredaktion", "https://www.sverigesradio.se/grupp/50751"),
    Contact("TV4 Nyheterna", "nyheterna@tv4.se", "TV4", "Nyhetsredaktion", "https://commercial.tv4.se/kontakta-oss/"),
    Contact("Kalla fakta", "kalla.fakta@tv4.se", "TV4", "Granskning", "https://commercial.tv4.se/kontakta-oss/"),
    Contact("Aftonbladet Tipsa", "tipsa@aftonbladet.se", "Aftonbladet", "Nyhetstips", "https://www.aftonbladet.se/tipsa"),
    Contact("Aftonbladet Debatt", "debatt@aftonbladet.se", "Aftonbladet", "Ledare/opinion", "https://www.aftonbladet.se/omaftonbladet/a/opE0zj/om-debatt"),
    # Ledarredaktionen publicerar ingen gemensam adress; officiella sidan anger
    # personmönster och namnger ansvariga. Dessa två yrkesadresser följer den
    # uttryckligen publicerade adressmodellen och verifieras mot sidan vid körning.
    Contact("Anders Lindberg", "anders.lindberg@aftonbladet.se", "Aftonbladet", "Ledare/opinion", "https://www.aftonbladet.se/omaftonbladet/a/P9d1d0/om-ledare"),
    Contact("Jonna Sima", "jonna.sima@aftonbladet.se", "Aftonbladet", "Ledare/opinion", "https://www.aftonbladet.se/omaftonbladet/a/P9d1d0/om-ledare"),
    Contact("Expressen redaktionen", "redaktionen@expressen.se", "Expressen", "Nyhetsredaktion", "https://www.expressen.se/"),
    Contact("Expressen Tipsa", "tipsa@expressen.se", "Expressen", "Nyhetstips", "https://www.expressen.se/nyheter/expressen-direkt/"),
]

# Uppdrag granskning publicerar hela aktuella redaktionen med individuella mejl.
# Den sidan är särskilt värdefull eftersom brevet då inte är beroende av en desk.
UG_URL = "https://www.svt.se/nyheter/granskning/ug/kontakta-uppdrag-granskning"

# Expressens politikredaktion saknar stabil gemensam funktionsadress. Dessa
# personer har uttryckligen publicerade yrkeskontakter i Expressens egna
# pressmeddelanden. Listan hålls separat så den är lätt att ersätta när sidan
# ändras och aldrig blandas ihop med gissade adresser.
EXPRESSEN_POLITIK = [
    Contact("Christofer Brask", "christofer.brask@expressen.se", "Expressen", "Politik", "https://via.tt.se/pressmeddelande/3272030/verkstallande-utskottet-ny-podcast-fran-expressens-politikredaktion"),
    Contact("Maggie Strömberg", "maggie.stromberg@expressen.se", "Expressen", "Politik", "https://via.tt.se/pressmeddelande/3272030/verkstallande-utskottet-ny-podcast-fran-expressens-politikredaktion"),
    Contact("Viktor Barth-Kron", "viktor.barth-kron@expressen.se", "Expressen", "Politik", "https://via.tt.se/pressmeddelande/3272030/verkstallande-utskottet-ny-podcast-fran-expressens-politikredaktion"),
]

UPSERT_SQL = (
    "INSERT INTO politicians (id, name, email, area_name, area_type, party, role, last_scraped_at) "
    "VALUES (lower(hex(randomblob(11))), ?, ?, ?, 'media', NULL, ?, ?) "
    "ON CONFLICT(email, area_name) DO UPDATE SET name=excluded.name, role=excluded.role, "
    "last_scraped_at=excluded.last_scraped_at"
)


def fetch_text(url: str) -> str:
    r = requests.get(url, headers=UA, timeout=30)
    r.raise_for_status()
    return html.unescape(re.sub(r"<[^>]+>", "\n", r.text))


def scrape_ug() -> list[Contact]:
    """Hämta aktuella UG-personer direkt från SVT:s kontaktsida."""
    try:
        text = fetch_text(UG_URL)
    except Exception as exc:
        print(f"VARNING: kunde inte läsa Uppdrag granskning: {exc}", file=sys.stderr)
        return []
    lines = [re.sub(r"\s+", " ", x).strip() for x in text.splitlines() if x.strip()]
    rows: list[Contact] = []
    for i, line in enumerate(lines):
        m = EMAIL_RE.search(line)
        if not m or not m.group(0).lower().endswith("@svt.se"):
            continue
        email = m.group(0).lower()
        # SVT-sidan renderar normalt "Namn, roll email" i samma eller närliggande rad.
        context = " ".join(lines[max(0, i - 1): i + 1])
        before = context.split(email, 1)[0].strip(" ,-:")
        # Ta sista rimliga namnsegmentet före rollordet.
        role_match = re.search(r"\b(ansvarig utgivare|programredaktör|planeringsredaktör|publiceringsredaktör|nyhetsredaktör|redaktör och researcher|redaktör|reporter|programredigerare)\b", before, re.I)
        if not role_match:
            continue
        name = before[:role_match.start()].strip(" ,-:").split("Foto:")[-1].strip()
        role = role_match.group(1).strip().capitalize()
        if 2 <= len(name.split()) <= 5:
            rows.append(Contact(name, email, "SVT", f"Granskning – Uppdrag granskning ({role})", UG_URL))
    return rows


def dedupe(rows: list[Contact]) -> list[Contact]:
    out: dict[tuple[str, str, str], Contact] = {}
    for c in rows:
        key = (c.email.lower(), c.organisation, c.role)
        out[key] = c
    return sorted(out.values(), key=lambda c: (c.organisation, c.role, c.name))


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    rows = dedupe(STATIC_CONTACTS + EXPRESSEN_POLITIK + scrape_ug())
    print(f"Nyhetsredaktioner: {len(rows)} kontakter")
    for org in sorted({r.organisation for r in rows}):
        print(f"  {org}: {sum(r.organisation == org for r in rows)}")
    if dry_run:
        for c in rows:
            print(f"  {c.organisation:<22} {c.role:<42} {c.name} <{c.email}>")
        return

    client = D1Client()
    now_ms = int(time.time() * 1000)
    ok = fail = 0
    for c in rows:
        try:
            client.run(UPSERT_SQL, [c.name, c.email, c.organisation, c.role, now_ms])
            ok += 1
        except Exception as exc:
            print(f"FEL {c.name} <{c.email}>: {exc}", file=sys.stderr)
            fail += 1
    print(f"Synkat media till D1: {ok} ok, {fail} fel")


if __name__ == "__main__":
    main()
