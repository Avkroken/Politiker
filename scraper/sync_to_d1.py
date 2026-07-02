#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Synkar skraparens resultat till D1-tabellen `politicians` i politiker-webapp-
projektet. Körs som ett extra steg efter en skrapningskörning (inte en del av
scraper.py självt — håller scraper-logiken oberörd).

Läser i första hand den maskinläsbara CSV:en (Alla_kommuner_och_regioner.csv),
som scrapern skriver just för det här steget. Faller tillbaka på att parsa den
människoläsbara .txt:en om CSV:n saknas (äldre körningar). CSV:n undviker den
spröda round-trip-parsningen av ett format som egentligen är till för att läsas
av människor.

D1:s HTTP-API stödjer inte parametrar tillsammans med flera statements i
samma anrop (verifierat 2026-06-22) — varje upsert skickas därför som ett
eget POST, parallelliserat med en liten trådpool för rimlig hastighet.

Miljövariabler: se d1.py (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN_POLITIKER,
D1_DATABASE_UUID).
"""

import csv
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

from d1 import D1Client

_RESULTAT_DIR = os.path.join(os.path.dirname(__file__), "..", "resultat")
RESULTAT_CSV = os.environ.get("RESULTAT_CSV", os.path.join(_RESULTAT_DIR, "Alla_kommuner_och_regioner.csv"))
RESULTAT_FIL = os.environ.get("RESULTAT_FIL", os.path.join(_RESULTAT_DIR, "Alla_kommuner_och_regioner.txt"))
MAX_WORKERS = 10

UPSERT_SQL = (
    "INSERT INTO politicians (id, name, email, area_name, area_type, party, role, last_scraped_at) "
    "VALUES (lower(hex(randomblob(11))), ?, ?, ?, ?, ?, ?, ?) "
    "ON CONFLICT(email, area_name) DO UPDATE SET name = excluded.name, party = excluded.party, role = excluded.role, last_scraped_at = excluded.last_scraped_at"
)

# Rad-format från scraper.py: "Namn <email> (PARTI) [Roll]" — parti och
# roll är båda valfria suffix och utelämnas helt om okända.
LINE_RE = re.compile(
    r"^(?:(?P<name>.+?)\s+<(?P<email_named>[^>]+)>|(?P<email_bare>\S+?@\S+?))"
    r"(?:\s*\((?P<party>[^)]+)\))?(?:\s*\[(?P<role>[^\]]+)\])?$"
)


def area_type_for(area_name: str) -> str:
    if area_name.startswith("Region "):
        return "region"
    if area_name in ("Sveriges riksdag", "Riksdagen"):
        return "riksdag"
    if "departementet" in area_name.lower() or "regeringskansliet" in area_name.lower() or area_name == "Regeringen":
        return "regering"
    return "kommun"


def parse_csv(path: str):
    """Returnerar lista av (name, email, area_name, area_type, party, role) ur
    den maskinläsbara CSV:en."""
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            email = (r.get("email") or "").strip()
            if not email:
                continue
            area = (r.get("area_name") or "").strip()
            rows.append((
                (r.get("name") or "").strip(),
                email.lower(),
                area,
                area_type_for(area),
                (r.get("party") or "").strip() or None,
                (r.get("role") or "").strip() or None,
            ))
    return rows


def parse_txt(path: str):
    """Fallback: returnerar samma tupler ur den människoläsbara .txt:en."""
    rows = []
    current_area = None
    with open(path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line:
                continue
            if line.startswith("## "):
                current_area = line[3:].strip()
                continue
            if current_area is None:
                continue
            m = LINE_RE.match(line)
            if not m:
                continue
            email = m.group("email_named") or m.group("email_bare")
            name = (m.group("name") or "").strip()
            party = (m.group("party") or "").strip() or None
            role = (m.group("role") or "").strip() or None
            rows.append((name, email.lower(), current_area, area_type_for(current_area), party, role))
    return rows


def load_rows():
    """Läser CSV:n om den finns, annars .txt:en (bakåtkompatibelt)."""
    if os.path.exists(RESULTAT_CSV):
        print(f"Läser {RESULTAT_CSV}")
        return parse_csv(RESULTAT_CSV)
    print(f"CSV saknas, faller tillbaka på {RESULTAT_FIL}")
    return parse_txt(RESULTAT_FIL)


def upsert_row(client: D1Client, row) -> tuple[bool, str]:
    name, email, area_name, area_type, party, role = row
    try:
        client.run(UPSERT_SQL, [name, email, area_name, area_type, party, role, int(time.time() * 1000)])
        return True, email
    except (requests.RequestException, RuntimeError) as err:
        return False, f"{email}: {err}"


def sync(rows) -> tuple[int, int]:
    client = D1Client()

    ok_count = 0
    fail_count = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(upsert_row, client, row): row for row in rows}
        for i, future in enumerate(as_completed(futures), 1):
            success, info = future.result()
            if success:
                ok_count += 1
            else:
                fail_count += 1
                print(f"FEL: {info}", file=sys.stderr)
            if i % 200 == 0:
                print(f"{i}/{len(rows)} klara ({ok_count} ok, {fail_count} fel)...")

    return ok_count, fail_count


def main():
    rows = load_rows()
    if not rows:
        print("Inga rader hittades att synka", file=sys.stderr)
        sys.exit(1)
    print(f"Hittade {len(rows)} (namn, email, område)-rader. Synkar till D1...")
    ok_count, fail_count = sync(rows)
    print(f"Klart. {ok_count} synkade, {fail_count} misslyckades.")
    if fail_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
