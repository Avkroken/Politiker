#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sanitera befintlig politikerdata i D1 utan att skrapa nya källor.

Jobbet normaliserar parti/grupp och befattning med samma regler som framtida
scraper-sync. Standardläget är dry-run. Skrivningar kräver uttryckligen
``--apply``.

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
SELECT_SQL = "SELECT id, party, role FROM politicians ORDER BY id"
UPDATE_SQL = "UPDATE politicians SET party = ?, role = ? WHERE id = ?"


def load_changes(client: D1Client):
    rows = client.query(SELECT_SQL, timeout=60)
    changes = []
    party_changes: Counter[tuple[str, str]] = Counter()
    role_changes: Counter[tuple[str, str]] = Counter()

    for row in rows:
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

    return rows, changes, party_changes, role_changes


def print_summary(total, changes, party_changes, role_changes):
    print(f"Rader i politicians: {len(total)}")
    print(f"Rader som behöver ändras: {len(changes)}")
    print(f"Partivärden som ändras: {sum(party_changes.values())}")
    print(f"Rollvärden som ändras: {sum(role_changes.values())}")

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


def apply_changes(changes):
    client = D1Client()
    ok = 0
    failed = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = [pool.submit(apply_change, client, change) for change in changes]
        for i, future in enumerate(as_completed(futures), 1):
            success, info = future.result()
            if success:
                ok += 1
            else:
                failed += 1
                print(f"FEL: {info}", file=sys.stderr)
            if i % 500 == 0:
                print(f"{i}/{len(changes)} klara ({ok} ok, {failed} fel)")
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
    rows, changes, party_changes, role_changes = load_changes(client)
    print_summary(rows, changes, party_changes, role_changes)

    if not changes:
        print("\nDatabasen är redan normaliserad.")
        return
    if not args.apply:
        print("\nDRY-RUN: inga ändringar skrevs. Kör igen med --apply för att verkställa.")
        return

    print("\nVerkställer saniteringen...")
    ok, failed = apply_changes(changes)
    print(f"Klart: {ok} uppdaterade, {failed} misslyckades.")
    if failed:
        sys.exit(1)

    # Efterkontroll: normaliseringen ska nu vara idempotent.
    verify_client = D1Client()
    _rows, remaining, _party, _role = load_changes(verify_client)
    if remaining:
        print(f"FEL: {len(remaining)} rader behöver fortfarande saniteras.", file=sys.stderr)
        sys.exit(1)
    print("Efterkontroll OK: inga ytterligare normaliseringsändringar behövs.")


if __name__ == "__main__":
    main()
