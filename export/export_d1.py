#!/usr/bin/env python3
"""Exporterar politicians-tabellen ur politiker-webapps D1 till publicerbara filer.

Producerar (i data/):
  - politiker.csv   kanonisk, människoläsbar databas
  - politiker.json  samma data, för programmatisk användning
  - politiker.sql   INSERT-satser för direkt import till en ny D1 (setup.sh)

Läser konfiguration ur miljön:
  CLOUDFLARE_API_TOKEN   token med D1-läsrättigheter
  CLOUDFLARE_ACCOUNT_ID  Cloudflare-konto-id
  D1_DATABASE_ID         databasens uuid

Deterministisk ordning + endast stabila fält (inga tidsstämplar/verifierings-
status) så att diffarna blir meningsfulla och inte brusar vid varje körning.
"""
from __future__ import annotations

import csv
import hashlib
import json
import os
import sys

# d1.py ligger i scraper/ bredvid export/ — lägg till den på importvägen.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scraper"))
from d1 import D1Client  # noqa: E402

# Fält som publiceras (stabila — utelämnar last_scraped_at/verification_status).
FIELDS = ["name", "email", "area_name", "area_type", "party", "role"]
PAGE = 5000


def fetch_all(client: D1Client) -> list[dict]:
    """Hämtar alla rader med keyset-paginering (WHERE-tuple > senaste raden)
    istället för LIMIT/OFFSET, så att en samtidig skrivning under exporten
    inte kan få rader att hoppas över eller dubbleras mellan sidorna.

    Keyset-nyckeln är (email, area_name) — tabellens UNIQUE-nyckel, alltså
    garanterat unik och NOT NULL (till skillnad från name, som kan vara tom).
    Utdatan sorteras sedan i Python på (area_type, area_name, name, email) för
    stabila, brusfria diffar."""
    rows: list[dict] = []
    cols = ", ".join(FIELDS)
    last: tuple | None = None
    while True:
        if last is None:
            sql = f"SELECT {cols} FROM politicians ORDER BY email, area_name LIMIT {PAGE}"
            params: list = []
        else:
            sql = (
                f"SELECT {cols} FROM politicians "
                f"WHERE (email, area_name) > (?, ?) ORDER BY email, area_name LIMIT {PAGE}"
            )
            params = list(last)
        page = client.query(sql, params, timeout=60)
        rows.extend(page)
        if len(page) < PAGE:
            break
        tail = page[-1]
        last = (tail["email"], tail["area_name"])
    rows.sort(key=lambda r: (r["area_type"] or "", r["area_name"] or "", r["name"] or "", r["email"] or ""))
    return rows


def sqlesc(val) -> str:
    if val is None or val == "":
        return "NULL"
    return "'" + str(val).replace("'", "''") + "'"


def write_outputs(rows: list[dict], outdir: str) -> None:
    os.makedirs(outdir, exist_ok=True)

    with open(os.path.join(outdir, "politiker.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r in rows:
            w.writerow({k: (r.get(k) or "") for k in FIELDS})

    with open(os.path.join(outdir, "politiker.json"), "w", encoding="utf-8") as f:
        json.dump(
            [{k: r.get(k) for k in FIELDS} for r in rows],
            f, ensure_ascii=False, indent=2, sort_keys=False,
        )
        f.write("\n")

    # SQL: deterministiskt id (sha1 av email|area_name, matchar UNIQUE-nyckeln),
    # konstant last_scraped_at=0 så filen inte brusar. INSERT OR IGNORE för fork-import.
    cols = "id, name, email, area_name, area_type, party, role, last_scraped_at, verification_status"
    with open(os.path.join(outdir, "politiker.sql"), "w", encoding="utf-8") as f:
        f.write("-- Genererad av export/export_d1.py — importera till ny D1 efter schema.sql.\n")
        f.write("-- wrangler d1 execute <db> --remote --file data/politiker.sql\n")
        for r in rows:
            rid = hashlib.sha1(f"{r['email']}|{r['area_name']}".encode()).hexdigest()
            vals = ", ".join([
                sqlesc(rid), sqlesc(r["name"]), sqlesc(r["email"]),
                sqlesc(r["area_name"]), sqlesc(r["area_type"]),
                sqlesc(r.get("party")), sqlesc(r.get("role")),
                "0", "'unknown'",
            ])
            f.write(f"INSERT OR IGNORE INTO politicians ({cols}) VALUES ({vals});\n")


def main() -> None:
    client = D1Client()
    outdir = os.path.join(os.path.dirname(__file__), "..", "data")
    rows = fetch_all(client)
    write_outputs(rows, outdir)
    print(f"Skrev {len(rows)} politiker till data/ (csv, json, sql)")


if __name__ == "__main__":
    main()
