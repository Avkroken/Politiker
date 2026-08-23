#!/usr/bin/env python3
"""Exporterar politicians-tabellen ur politikers D1 till publicerbara filer.

Producerar (i data/): politiker.csv/json/sql samt recipient-meta.json med endast
aggregerad filtermetadata för webbklienten. Metadatafilen innehåller ingen PII.
"""
from __future__ import annotations

import csv
import hashlib
import json
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scraper"))
from d1 import D1Client  # noqa: E402

FIELDS = ["name", "email", "area_name", "area_type", "party", "role"]
PAGE = 5000


def fetch_all(client: D1Client) -> list[dict]:
    rows: list[dict] = []
    cols = ", ".join(FIELDS)
    last: tuple | None = None
    # Exportera samma aktiva population som utskickslogiken använder. Döda
    # adresser ska varken synas i metadata-count eller i publicerad export.
    active = "(verification_status IS NULL OR verification_status NOT IN ('dead','dead_via_send'))"
    while True:
        if last is None:
            sql = f"SELECT {cols} FROM politicians WHERE {active} ORDER BY email, area_name LIMIT {PAGE}"
            params: list = []
        else:
            sql = (
                f"SELECT {cols} FROM politicians WHERE {active} "
                f"AND (email, area_name) > (?, ?) ORDER BY email, area_name LIMIT {PAGE}"
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


def recipient_meta(rows: list[dict]) -> dict:
    areas = Counter()
    parties = Counter()
    roles = Counter()
    for r in rows:
        area_name = (r.get("area_name") or "").strip()
        area_type = (r.get("area_type") or "").strip()
        party = (r.get("party") or "").strip()
        role = (r.get("role") or "").strip()
        if area_name:
            areas[(area_type, area_name)] += 1
            if party:
                parties[(area_type, area_name, party)] += 1
        if role:
            roles[role] += 1
    return {
        "version": 1,
        "areas": [
            {"area_type": t, "area_name": n, "count": c}
            for (t, n), c in sorted(areas.items())
        ],
        "parties": [
            {"area_type": t, "area_name": n, "party": p, "count": c}
            for (t, n, p), c in sorted(parties.items())
        ],
        "roles": [
            {"role": role, "role_key": role.strip().lower(), "count": count, "kind": "role"}
            for role, count in sorted(roles.items(), key=lambda x: (-x[1], x[0].lower()))
        ],
    }


def write_outputs(rows: list[dict], outdir: str) -> None:
    os.makedirs(outdir, exist_ok=True)
    with open(os.path.join(outdir, "politiker.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS); w.writeheader()
        for r in rows: w.writerow({k: (r.get(k) or "") for k in FIELDS})
    with open(os.path.join(outdir, "politiker.json"), "w", encoding="utf-8") as f:
        json.dump([{k: r.get(k) for k in FIELDS} for r in rows], f, ensure_ascii=False, indent=2); f.write("\n")
    with open(os.path.join(outdir, "recipient-meta.json"), "w", encoding="utf-8") as f:
        json.dump(recipient_meta(rows), f, ensure_ascii=False, separators=(",", ":")); f.write("\n")
    cols = "id, name, email, area_name, area_type, party, role, last_scraped_at, verification_status"
    with open(os.path.join(outdir, "politiker.sql"), "w", encoding="utf-8") as f:
        f.write("-- Genererad av export/export_d1.py — importera till ny D1 efter schema.sql.\n")
        f.write("-- wrangler d1 execute <db> --remote --file data/politiker.sql\n")
        for r in rows:
            rid = hashlib.sha1(f"{r['email']}|{r['area_name']}".encode()).hexdigest()
            vals = ", ".join([sqlesc(rid), sqlesc(r["name"]), sqlesc(r["email"]), sqlesc(r["area_name"]), sqlesc(r["area_type"]), sqlesc(r.get("party")), sqlesc(r.get("role")), "0", "'unknown'"])
            f.write(f"INSERT OR IGNORE INTO politicians ({cols}) VALUES ({vals});\n")


def main() -> None:
    client = D1Client()
    outdir = os.path.join(os.path.dirname(__file__), "..", "data")
    rows = fetch_all(client)
    write_outputs(rows, outdir)
    print(f"Skrev {len(rows)} aktiva politiker + recipient-meta.json till data/")


if __name__ == "__main__":
    main()
