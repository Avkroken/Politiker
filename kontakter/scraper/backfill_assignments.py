#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bakåtfyll politiska nämnder/organ från Troman-profiler till D1.

Endast nämndens/organets namn sparas. Detaljerade befattningar som ledamot,
ersättare, ordförande eller sekreterare samlas inte in eftersom de inte behövs
för Politikerkontakts mottagarurval.
"""
from __future__ import annotations

import html
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

import requests
from d1 import D1Client


def load_regioner() -> list[dict]:
    return json.loads(Path(__file__).with_name("regioner.json").read_text(encoding="utf-8"))


def fetch(url: str, timeout: int = 30) -> str | None:
    try:
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()
        return response.text
    except requests.RequestException as exc:
        print(f"  FEL {url}: {exc}", file=sys.stderr, flush=True)
        return None


def clean_text(fragment: str) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", "", fragment))
    return re.sub(r"\s+", " ", text).strip()


def email_from_page(page_html: str) -> set[str]:
    emails = set()
    for href in re.findall(r'href="(mailto:[^"]+)"', page_html, re.I):
        email = href[7:].split("?", 1)[0].strip().lower()
        if "@" in email:
            emails.add(email)
    return emails


def bodies(page_html: str) -> list[str]:
    match = re.search(r'id="engagementTable:tbody_element"(.*?)</table>', page_html, re.S | re.I)
    if not match:
        match = re.search(r'<table[^>]*id="engagementTable"[^>]*>(.*?)</table>', page_html, re.S | re.I)
    if not match:
        return []
    found: list[str] = []
    seen: set[str] = set()
    for row in re.finditer(r"<tr[^>]*>(.*?)</tr>", match.group(1), re.S | re.I):
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row.group(1), re.S | re.I)
        if not cells:
            continue
        body = clean_text(cells[0])
        key = body.casefold()
        if body and key not in seen:
            seen.add(key)
            found.append(body)
    return found


def main() -> None:
    client = D1Client()
    targets = [row for row in load_regioner() if row.get("typ") == "troman"]
    now_ms = int(time.time() * 1000)
    total_people = total_bodies = total_missing = 0

    print(f"{len(targets)} Troman-kommuner/regioner att läsa.", flush=True)
    for index, region in enumerate(targets, 1):
        area_name = region["namn"]
        print(f"[{index}/{len(targets)}] {area_name}...", flush=True)
        listing = fetch(region["url"])
        if not listing:
            continue
        base = re.match(r"(https?://[^/]+)", region["url"])
        if not base:
            continue
        person_paths = sorted(set(re.findall(r'href="(/person/[a-f0-9-]+)"', listing, re.I)))
        area_bodies = area_missing = 0
        for person_path in person_paths:
            page = fetch(urljoin(base.group(1), person_path), timeout=20)
            if not page:
                continue
            person_bodies = bodies(page)
            emails = email_from_page(page)
            if not person_bodies or not emails:
                continue
            matched = False
            for email in emails:
                rows = client.run("SELECT id FROM politicians WHERE area_name = ? AND lower(trim(email)) = ? LIMIT 1", [area_name, email])
                result = rows.get("results", []) if isinstance(rows, dict) else []
                if not result:
                    continue
                matched = True
                politician_id = result[0]["id"]
                client.run("DELETE FROM politician_assignments WHERE politician_id = ? AND source = 'troman'", [politician_id])
                for body in person_bodies:
                    client.run(
                        "INSERT OR IGNORE INTO politician_assignments "
                        "(politician_id, area_name, body, role, source, last_scraped_at) VALUES (?, ?, ?, '', 'troman', ?)",
                        [politician_id, area_name, body, now_ms],
                    )
                    area_bodies += 1
                total_people += 1
                break
            if not matched:
                area_missing += 1
            time.sleep(0.15)
        total_bodies += area_bodies
        total_missing += area_missing
        print(f"  {area_bodies} nämnd/organ-kopplingar sparade, {area_missing} profiler utan D1-match", flush=True)

    print(f"\nKlart: {total_people} personer, {total_bodies} nämnd/organ-kopplingar, {total_missing} profiler utan D1-match.", flush=True)


if __name__ == "__main__":
    main()
