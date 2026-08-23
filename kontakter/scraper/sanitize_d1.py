#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sanitera befintlig mottagardata i D1 utan att skrapa nya källor.

Behåller endast information som behövs för mottagarurvalet: person, område,
politisk nivå, parti och separat nämnd/organ. Detaljerade befattningar tas bort.
Standardläget är dry-run; ``--apply`` krävs för skrivningar.
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

IRRELEVANT_ROLE_SQL = """
(
  LOWER(role) LIKE '%revisor%'
  OR LOWER(role) LIKE '%nämndeman%'
  OR LOWER(role) LIKE '%nämndemän%'
  OR LOWER(role) LIKE '%vigselförrätt%'
  OR LOWER(role) LIKE '%partnerskapsförrätt%'
  OR LOWER(role) = 'god man'
  OR LOWER(role) LIKE 'gode män%'
)
""".strip()

APPLY_SQL = f"""
DELETE FROM politicians
WHERE area_type = 'eu'
  AND area_name <> '{SWEDISH_EU_AREA}';

-- Använd de gamla rollvärdena en sista gång för att ta bort rader som inte
-- representerar relevanta politiska mottagare. Därefter rensas rollfältet helt.
DELETE FROM politicians
WHERE area_type IN ('kommun', 'region')
  AND role IS NOT NULL
  AND TRIM(role) <> ''
  AND {IRRELEVANT_ROLE_SQL};

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
    LOWER(TRIM(party)) IN ('', '-', '--', 'saknas', 'oberoende', 'ober', 'opol', 'opol.', 'partilös', 'partilos', 'utan partitillhörighet', 'parti saknas')
    OR LOWER(TRIM(party)) LIKE 'fd %'
    OR LOWER(TRIM(party)) LIKE '%, fd %'
    OR LOWER(TRIM(party)) LIKE '% fd %'
  );

UPDATE politicians SET role = NULL WHERE role IS NOT NULL;
UPDATE politician_assignments SET role = '' WHERE role <> '';
""".strip()


def wrangler(*args: str) -> None:
    try:
        subprocess.run(["npx", "wrangler", *args], cwd=REPO_ROOT, check=True)
    except FileNotFoundError:
        sys.exit("FEL: npx hittades inte. Kör jobbet på servern där Wrangler används.")
    except subprocess.CalledProcessError as exc:
        sys.exit(exc.returncode)


def query(sql: str) -> None:
    wrangler("d1", "execute", DB_NAME, "--remote", "--command", sql)


def dry_run() -> None:
    print("=== D1 SANITERING: DRY-RUN ===")
    print("\nUtländska EU-rader som skulle tas bort:")
    query(f"SELECT area_name, COUNT(*) AS rows FROM politicians WHERE area_type='eu' AND area_name<>'{SWEDISH_EU_AREA}' GROUP BY area_name ORDER BY area_name;")
    print("\nIrrelevanta kommun-/regionuppdrag som skulle tas bort:")
    query("SELECT area_type, role, COUNT(*) AS rows FROM politicians WHERE area_type IN ('kommun','region') AND role IS NOT NULL AND " + IRRELEVANT_ROLE_SQL + " GROUP BY area_type, role ORDER BY rows DESC, role;")
    print("\nDetaljerade huvudroller som skulle rensas:")
    query("SELECT COUNT(*) AS rows FROM politicians WHERE role IS NOT NULL AND TRIM(role) <> ''; ")
    print("\nDetaljerade nämndroller som skulle rensas:")
    query("SELECT COUNT(*) AS rows FROM politician_assignments WHERE role <> ''; ")
    print("\nPartivärden före normalisering:")
    query("SELECT party, COUNT(*) AS rows FROM politicians WHERE party IS NOT NULL GROUP BY party ORDER BY rows DESC, party LIMIT 200;")
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
    query(f"SELECT COUNT(*) AS rows FROM politicians WHERE area_type='eu' AND area_name<>'{SWEDISH_EU_AREA}';")
    print("\nEfterkontroll: detaljerade huvudroller (ska vara 0):")
    query("SELECT COUNT(*) AS rows FROM politicians WHERE role IS NOT NULL AND TRIM(role) <> ''; ")
    print("\nEfterkontroll: detaljerade nämndroller (ska vara 0):")
    query("SELECT COUNT(*) AS rows FROM politician_assignments WHERE role <> ''; ")
    print("\nEfterkontroll: kvarvarande EU-områden:")
    query("SELECT area_name, COUNT(*) AS rows FROM politicians WHERE area_type='eu' GROUP BY area_name;")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Verkställ saniteringen i politiker-eu.")
    args = parser.parse_args()
    apply() if args.apply else dry_run()


if __name__ == "__main__":
    main()
