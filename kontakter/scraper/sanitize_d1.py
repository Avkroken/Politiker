#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sanitera befintlig politikerdata i D1 utan att skrapa nya källor.

Jobbet normaliserar parti/grupp och befattning med samma regler som framtida
scraper-sync. Det tar dessutom bort EU-parlamentariker som inte representerar
Sverige; Politikerkontakt är inriktat på svenska politiska företrädare, medan
Sveriges egna EU-parlamentariker fortfarande är relevanta mottagare.

Standardläget är dry-run. Skrivningar kräver uttryckligen ``--apply``.

Miljövariabler läses av d1.D1Client:
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_API_TOKEN_POLITIKER (eller CLOUDFLARE_API_TOKEN)
  D1_DATABASE_UUID               (eller D1_DATABASE_ID)
"""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
import sys

import requests

from d1 import D1Client
from politiker_common import normalize_party, normalize_role

MAX_WORKERS = 8
SWEDISH_EU_AREA = "Europaparlamentet (Sverige)"
SELECT_SQL = "SELECT id, area_type, area_name, party, role FROM politicians ORDER BY id"
UPDATE_SQL = "UPDATE politicians SET party = ?, role = ? WHERE id = ?"
DELETE_SQL = "DELETE FROM politicians WHERE id = ?"


def should_delete(row: dict) -> bool:
    """Ta bara bort utländska EU-ledamöter; svensk och lokal data bevaras."""
    return row.get("area_type") == "eu" and row.get("area_name") != SWEDISH_EU_AREA


def load_changes(client: D1Client):
    rows = client.query(SELECT_SQL, timeout=60)
    deletes = []
    changes = []
    party_changes: Counter[tuple[str, str]] = Counter()
    role_changes: Counter[tuple[str, str]] = Counter()
    deleted_areas: Counter[str] = Counter()

    for row in rows:
        if should_delete(row):
            deletes.append(row["id"])
            deleted_areas[str(row.get("area_name"))] += 1
            continue

        old_party = row.get("party")
        old_role = row.get("role")
        new_party = normalize_party(old_party)
        new_role = normalize_role(old_role)
        if old_party == new_party and old_role == new_role:
            continue
        changes.append((row["id"], old_party, new_party, old_role, new_role))
        if old_party != new_party:
            party_changes[(str(old_party), str(new_party))] += 1
        if old_role != new_role:
            role_changes[(str(old_role), str(new_role))] += 1

    return rows, deletes, changes, party_changes, role_changes, deleted_areas


def print_summary(total, deletes, changes, party_changes, role_changes, deleted_areas):
    print(f"Rader i politicians: {len(total)}")
    print(f"Utländska EU-rader som tas bort: {len(deletes)}")
    print(f"Övriga rader som behöver ändras: {len(changes)}")
    print(f"Partivärden som ändras: {sum(party_changes.values())}")
    print(f"Rollvärden som ändras: {sum(role_changes.values())}")

    if deleted_areas:
        print("\nEU-områden som tas bort:")
        for area, count in deleted_areas.most_common():
            print(f"  {count:5d}  {area}")
    if party_changes:
        print("\nVanligaste partiändringarna:")
        for (old, new), count in party_changes.most_common(30):
            print(f"  {count:5d}  {old!r} -> {new!r}")
    if role_changes:
        print("\nVanligaste rolländringarna:")
        for (old, new), count in role_changes.most_common(30):
            print(f"  {count:5d}  {old!r} -> {new!r}")


def apply_change(client: D1Client, change):
    row_id, _old_party, new_party, _old_role, new_role = change
    try:
        client.run(UPDATE_SQL, [new_party, new_role, row_id])
        return True, row_id
    except (requests.RequestException, RuntimeError) as err:
        return False, f"{row_id}: {err}"


def delete_row(client: D1Client, row_id: str):
    try:
        client.run(DELETE_SQL, [row_id])
        return True, row_id
    except (requests.RequestException, RuntimeError) as err:
        return False, f"{row_id}: {err}"


def run_parallel(items, fn, label):
    if not items:
        return 0, 0
    client = D1Client()
    ok = failed = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = [pool.submit(fn, client, item) for item in items]
        for i, future in enumerate(as_completed(futures), 1):
            success, info = future.result()
            if success:
                ok += 1
            else:
                failed += 1
                print(f"FEL: {info}", file=sys.stderr)
            if i % 500 == 0:
                print(f"{label}: {i}/{len(items)} klara ({ok} ok, {failed} fel)")
    return ok, failed


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Skriv ändringarna till D1. Utan flaggan görs endast dry-run.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    client = D1Client()
    rows, deletes, changes, party_changes, role_changes, deleted_areas = load_changes(client)
    print_summary(rows, deletes, changes, party_changes, role_changes, deleted_areas)

    if not deletes and not changes:
        print("\nDatabasen är redan normaliserad.")
        return
    if not args.apply:
        print("\nDRY-RUN: inga ändringar skrevs. Kör igen med --apply för att verkställa.")
        return

    failed = 0
    if deletes:
        print("\nTar bort utländska EU-ledamöter...")
        ok_delete, failed_delete = run_parallel(deletes, delete_row, "Radering")
        print(f"Radering: {ok_delete} borttagna, {failed_delete} misslyckades.")
        failed += failed_delete

    if changes:
        print("\nVerkställer normaliseringen...")
        ok_update, failed_update = run_parallel(changes, apply_change, "Normalisering")
        print(f"Normalisering: {ok_update} uppdaterade, {failed_update} misslyckades.")
        failed += failed_update

    if failed:
        sys.exit(1)

    # Efterkontroll: saniteringen ska nu vara idempotent.
    verify_client = D1Client()
    _rows, remaining_deletes, remaining_changes, _party, _role, _areas = load_changes(verify_client)
    if remaining_deletes or remaining_changes:
        print(
            f"FEL: {len(remaining_deletes)} rader ska fortfarande raderas och "
            f"{len(remaining_changes)} rader behöver fortfarande normaliseras.",
            file=sys.stderr,
        )
        sys.exit(1)
    print("Efterkontroll OK: endast svensk EU-representation återstår och inga ytterligare normaliseringsändringar behövs.")


if __name__ == "__main__":
    main()
