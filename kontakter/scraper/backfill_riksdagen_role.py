#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bakåtfyller befattning för riksdagens nuvarande ledamöter i D1-tabellen
`politicians`, baserat på deras MEST framträdande aktuella utskottsuppdrag.

Riksdagens egen "kammaruppdrag" (organ_kod='kam') visar bara "Riksdagsledamot"
för alla — inte användbart som filter. Det meningsfulla är utskottsrollen
(organ_kod != 'kam', typ='uppdrag'): Ordförande/Vice ordförande/Ledamot/
Suppleant. En person kan ha flera utskottsuppdrag — väljer det mest
framträdande (Ordförande > Vice ordförande > Ledamot > Suppleant).

Matchar mot politicians via email (redan ifylld av fetch_riksdagen_members.py).

Miljövariabler som krävs (samma .env som sync_to_d1.py):
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_API_TOKEN_POLITIKER
  D1_DATABASE_UUID
"""

import sys
import time
from datetime import datetime, timezone

import requests

from d1 import D1Client

RIKSDAGEN_API = "https://data.riksdagen.se/personlista/?utformat=json"
ROLE_PRIORITY = {"Ordförande": 0, "Vice ordförande": 1, "Ledamot": 2, "Suppleant": 3}


def fetch_current_members() -> list[dict]:
    last_err = None
    for attempt in range(5):
        try:
            resp = requests.get(RIKSDAGEN_API, timeout=180)
            resp.raise_for_status()
            return resp.json()["personlista"]["person"]
        except requests.exceptions.RequestException as err:
            last_err = err
            print(f"Försök {attempt + 1}/5 misslyckades ({err}), försöker igen...", file=sys.stderr, flush=True)
            time.sleep(5)
    # last_err är satt i praktiken (loopen körs alltid fem varv), men typen är
    # Optional — och `raise None` ger ett TypeError som döljer det verkliga
    # felet just när något gått snett.
    if last_err is None:
        raise RuntimeError(f"Kunde inte hämta {RIKSDAGEN_API} efter 5 försök")
    raise last_err


def best_committee_role(person: dict, now: str) -> str | None:
    uppdrag = person.get("personuppdrag", {}).get("uppdrag", [])
    if isinstance(uppdrag, dict):  # D1 (en enda post) ger ibland ett objekt istället för en lista
        uppdrag = [uppdrag]
    best: str | None = None
    best_rank = 99
    for u in uppdrag:
        if u.get("typ") != "uppdrag" or u.get("organ_kod") == "kam":
            continue
        tom = u.get("tom") or ""
        if tom and tom <= now:
            continue
        role = u.get("roll_kod")
        rank = ROLE_PRIORITY.get(role, 50)
        if rank < best_rank:
            best, best_rank = role, rank
    return best


def extract_email(person: dict) -> str | None:
    for u in person.get("personuppgift", {}).get("uppgift", []):
        if u.get("kod") == "Officiell e-postadress":
            raw = u["uppgift"][0] if u.get("uppgift") else None
            if raw:
                return raw.replace("[på]", "@")
    return None


def main():
    client = D1Client()

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    people = fetch_current_members()
    print(f"Hittade {len(people)} nuvarande riksdagsledamöter.", flush=True)

    now_ms = int(time.time() * 1000)
    ok = fail = skipped = 0
    for i, p in enumerate(people, 1):
        email = extract_email(p)
        role = best_committee_role(p, now)
        if not email or not role:
            skipped += 1
            continue
        try:
            client.run(
                "UPDATE politicians SET role = ?, last_scraped_at = ? WHERE area_type = 'riksdag' AND email = ?",
                [role, now_ms, email],
            )
            ok += 1
        except (requests.RequestException, RuntimeError) as err:
            fail += 1
            print(f"FEL: {email}: {err}", file=sys.stderr, flush=True)
        if i % 50 == 0:
            print(f"{i}/{len(people)} klara ({ok} ok, {fail} fel, {skipped} utan roll/email)...", flush=True)

    print(f"Klart. {ok} uppdaterade, {fail} misslyckades, {skipped} hade ingen aktuell utskottsroll.", flush=True)
    if fail > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
