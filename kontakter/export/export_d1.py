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
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scraper"))
from d1 import D1Client  # noqa: E402

FIELDS = ["name", "email", "area_name", "area_type", "party", "role"]
PAGE = 5000
SWEDISH_EU_AREA = "Europaparlamentet (Sverige)"
VICE_ONLY = re.compile(r"^\d+\s*[:.]?\s*[ae]?\s*vice$")


def canonical_role(raw: str) -> tuple[str, str]:
    """Matcha app/src/roles.ts så statisk metadata och D1-API använder samma nycklar."""
    s = raw.strip().lower()
    if "ordf" in s or VICE_ONLY.match(s):
        return "ordförande", "Ordförande"
    if "gruppledare" in s:
        return "gruppledare", "Gruppledare"
    if "ledamot" in s or "ledamöter" in s or s == "led":
        return "ledamot", "Ledamot"
    if "ersätt" in s or "supple" in s or s == "ers":
        return "ersättare", "Ersättare"
    return "övrigt", "Övrigt"


def is_publishable_row(row: dict) -> bool:
    """Förhindra att kända stale/irrelevanta D1-rader publiceras mellan saniteringar."""
    area_type = (row.get("area_type") or "").strip().lower()
    area_name = (row.get("area_name") or "").strip()
    role = (row.get("role") or "").strip().lower()
    if area_type == "eu" and area_name != SWEDISH_EU_AREA:
        return False
    if area_type in {"kommun", "region"} and role:
        if (
            "revisor" in role
            or "nämndeman" in role
            or "nämndemän" in role
            or "vigselförrätt" in role
            or "partnerskapsförrätt" in role
            or role == "god man"
            or role.startswith("gode män")
        ):
            return False
    return True


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
        rows.extend(r for r in page if is_publishable_row(r))
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
    roles: dict[str, dict[str, str | int]] = {}
    for r in rows:
        if not is_publishable_row(r):
            continue
        area_name = (r.get("area_name") or "").strip()
        area_type = (r.get("area_type") or "").strip()
        party = (r.get("party") or "").strip()
        role = (r.get("role") or "").strip()
        if area_name:
            areas[(area_type, area_name)] += 1
            if party:
                parties[(area_type, area_name, party)] += 1
        if role:
            key, label = canonical_role(role)
            entry = roles.setdefault(key, {"role": label, "role_key": key, "count": 0, "kind": "role"})
            entry["count"] = int(entry["count"]) + 1
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
        "roles": sorted(roles.values(), key=lambda x: (-int(x["count"]), str(x["role"]))),
    }


def write_outputs(rows: list[dict], outdir: str) -> None:
    rows = [r for r in rows if is_publishable_row(r)]
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
