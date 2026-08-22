#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sanitera befintlig politikerdata i D1 utan att skrapa nya källor.

Politikerkontakt ska innehålla svenska politiska företrädare hela vägen från
kommunnivå till Sveriges representation i Europaparlamentet. Jobbet:

* tar bort EU-ledamöter som representerar andra länder än Sverige,
* normaliserar kända svenska rikspartier och uppenbara case-varianter,
* tar bort status-/skräpvärden ur party,
* normaliserar mottagarrelevanta roller,
* lämnar okända lokala partinamn orörda.

Jobbet använder projektets redan autentiserade Wrangler-installation. Ingen
separat .env eller Cloudflare-tokenfil behövs. Standardläget är dry-run;
``--apply`` krävs för skrivningar.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import subprocess
import sys
import tempfile

DB_NAME = "politiker-eu"
SWEDISH_EU_AREA = "Europaparlamentet (Sverige)"
REPO_ROOT = Path(__file__).resolve().parents[2]

# Medvetet konservativt: endast säkra alias normaliseras. Lokala listor som
# Bergspartiet, Götenes framtid, Vårddemokraterna osv lämnas orörda.
APPLY_SQL = f"""
DELETE FROM politicians
WHERE area_type = 'eu'
  AND area_name <> '{SWEDISH_EU_AREA}';

UPDATE politicians
SET party = CASE LOWER(TRIM(party))
  WHEN 's' THEN 'S'
  WHEN 'socialdemokraterna' THEN 'S'
  WHEN 'socialdemokratiska arbetarepartiet' THEN 'S'
  WHEN 'm' THEN 'M'
  WHEN 'moderaterna' THEN 'M'
  WHEN 'moderata samlingspartiet' THEN 'M'
  WHEN 'sd' THEN 'SD'
  WHEN 'sverigedemokraterna' THEN 'SD'
  WHEN 'v' THEN 'V'
  WHEN 'vänsterpartiet' THEN 'V'
  WHEN 'c' THEN 'C'
  WHEN 'centerpartiet' THEN 'C'
  WHEN 'l' THEN 'L'
  WHEN 'liberalerna' THEN 'L'
  WHEN 'folkpartiet liberalerna' THEN 'L'
  WHEN 'kd' THEN 'KD'
  WHEN 'kristdemokraterna' THEN 'KD'
  WHEN 'mp' THEN 'MP'
  WHEN 'miljöpartiet' THEN 'MP'
  WHEN 'miljöpartiet de gröna' THEN 'MP'
  WHEN 'fi' THEN 'FI'
  WHEN 'feministiskt initiativ' THEN 'FI'
  WHEN 'med' THEN 'MED'
  WHEN 'medborgerlig samling' THEN 'MED'
  ELSE TRIM(party)
END
WHERE party IS NOT NULL;

UPDATE politicians
SET party = NULL
WHERE party IS NOT NULL
  AND (
    LOWER(TRIM(party)) IN (
      '', '-', '--', 'saknas', 'oberoende', 'ober', 'opol', 'opol.',
      'partilös', 'partilos', 'utan partitillhörighet', 'parti saknas'
    )
    OR LOWER(TRIM(party)) LIKE 'fd %'
    OR LOWER(TRIM(party)) LIKE '%, fd %'
    OR LOWER(TRIM(party)) LIKE '% fd %'
  );

UPDATE politicians
SET role = CASE
  WHEN role IS NULL OR TRIM(role) = '' THEN NULL
  WHEN LOWER(role) LIKE '%gruppledare%' THEN 'Gruppledare'
  WHEN LOWER(role) LIKE '%ordf%' THEN 'Ordförande'
  WHEN LOWER(role) LIKE '%ledamot%' OR LOWER(TRIM(role)) = 'led' THEN 'Ledamot'
  WHEN LOWER(role) LIKE '%ersätt%' OR LOWER(role) LIKE '%supple%' OR LOWER(TRIM(role)) = 'ers' THEN 'Ersättare'
  ELSE NULL
END;
""".strip()


def wrangler(*args: str) -> None:
    cmd = ["npx", "wrangler", *args]
    try:
        # Kör från repots rot. Det är samma kontext som de manuella Wrangler-
        # kommandon som används för politiker-eu på servern och undviker att
        # app/wrangler.jsonc påverkar fristående databasunderhåll.
        subprocess.run(cmd, cwd=REPO_ROOT, check=True)
    except FileNotFoundError:
        sys.exit("FEL: npx hittades inte. Kör jobben på servern där Wrangler redan används.")
    except subprocess.CalledProcessError as exc:
        sys.exit(exc.returncode)


def query(sql: str) -> None:
    wrangler("d1", "execute", DB_NAME, "--remote", "--command", sql)


def dry_run() -> None:
    print("=== D1 SANITERING: DRY-RUN ===")
    print("\nUtländska EU-rader som skulle tas bort:")
    query(
        f"SELECT area_name, COUNT(*) AS rows FROM politicians "
        f"WHERE area_type='eu' AND area_name<>'{SWEDISH_EU_AREA}' "
        "GROUP BY area_name ORDER BY area_name;"
    )
    print("\nPartivärden före normalisering (vanligaste först):")
    query(
        "SELECT party, COUNT(*) AS rows FROM politicians WHERE party IS NOT NULL "
        "GROUP BY party ORDER BY rows DESC, party LIMIT 200;"
    )
    print("\nRollvärden före normalisering:")
    query(
        "SELECT role, COUNT(*) AS rows FROM politicians WHERE role IS NOT NULL "
        "GROUP BY role ORDER BY rows DESC, role LIMIT 100;"
    )
    print("\nDRY-RUN: inga ändringar skrevs. Kör med --apply efter granskning.")


def apply() -> None:
    print("=== D1 SANITERING: APPLY ===")
    with tempfile.NamedTemporaryFile("w", suffix=".sql", encoding="utf-8", delete=False) as f:
        f.write(APPLY_SQL)
        sql_path = Path(f.name)
    try:
        wrangler("d1", "execute", DB_NAME, "--remote", "--file", str(sql_path))
    finally:
        sql_path.unlink(missing_ok=True)

    print("\nEfterkontroll: utländska EU-rader (ska vara 0):")
    query(
        f"SELECT COUNT(*) AS rows FROM politicians "
        f"WHERE area_type='eu' AND area_name<>'{SWEDISH_EU_AREA}';"
    )
    print("\nEfterkontroll: kvarvarande EU-områden:")
    query("SELECT area_name, COUNT(*) AS rows FROM politicians WHERE area_type='eu' GROUP BY area_name;")
    print("\nEfterkontroll: partier:")
    query(
        "SELECT party, COUNT(*) AS rows FROM politicians WHERE party IS NOT NULL "
        "GROUP BY party ORDER BY party;"
    )


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Verkställ saniteringen i politiker-eu.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.apply:
        apply()
    else:
        dry_run()


if __name__ == "__main__":
    main()
