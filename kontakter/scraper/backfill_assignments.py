#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bakåtfyll politiska nämnder/organ från Troman-profiler till D1.

Endast nämndens/organets namn sparas. Detaljerade befattningar som ledamot,
ersättare, ordförande eller sekreterare samlas inte in eftersom de inte behövs
för Politikerkontakts mottagarurval.

D1 läses och skrivs via Wrangler. Därmed återanvänds den Cloudflare-inloggning
som redan används av resten av repot och skriptet kräver inga separata
CLOUDFLARE_* eller D1_* miljövariabler. HTTP-hämtning använder endast Pythons
standardbibliotek, så inga pip-paket behövs heller.
"""
from __future__ import annotations

import html
import json
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

REPO_ROOT = Path(__file__).resolve().parents[2]
WRANGLER_CONFIG = REPO_ROOT / "app" / "wrangler.jsonc"
D1_NAME = "politiker-eu"


def load_regioner() -> list[dict]:
    return json.loads(Path(__file__).with_name("regioner.json").read_text(encoding="utf-8"))


def fetch(url: str, timeout: int = 30) -> str | None:
    try:
        request = Request(url, headers={"User-Agent": "Politikerkontakt scraper/1.0"})
        with urlopen(request, timeout=timeout) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset, errors="replace")
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
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


def wrangler_args() -> list[str]:
    return [
        "npx", "wrangler", "d1", "execute", D1_NAME,
        "--remote", "--config", str(WRANGLER_CONFIG),
    ]


def wrangler_json(sql: str) -> object:
    proc = subprocess.run(
        wrangler_args() + ["--command", sql, "--json"],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0:
        if proc.stdout:
            print(proc.stdout, file=sys.stderr)
        if proc.stderr:
            print(proc.stderr, file=sys.stderr)
        sys.exit("FEL: kunde inte läsa D1 via Wrangler.")
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        print(proc.stdout, file=sys.stderr)
        sys.exit("FEL: Wrangler returnerade inte giltig JSON.")


def find_result_rows(value: object) -> list[dict]:
    """Hitta Wranglers SELECT-rader utan att låsa oss till en viss CLI-version."""
    if isinstance(value, dict):
        results = value.get("results")
        if isinstance(results, list) and (not results or isinstance(results[0], dict)):
            return results
        for child in value.values():
            rows = find_result_rows(child)
            if rows:
                return rows
    elif isinstance(value, list):
        for child in value:
            rows = find_result_rows(child)
            if rows:
                return rows
    return []


def load_politician_index() -> dict[tuple[str, str], str]:
    print("Läser befintliga politiker från D1 via Wrangler...", flush=True)
    payload = wrangler_json(
        "SELECT id, lower(trim(email)) AS email, area_name FROM politicians "
        "WHERE email IS NOT NULL AND trim(email) <> '';"
    )
    rows = find_result_rows(payload)
    if not rows:
        sys.exit("FEL: kunde inte läsa några politiker från D1.")
    index: dict[tuple[str, str], str] = {}
    for row in rows:
        pid = str(row.get("id") or "").strip()
        email = str(row.get("email") or "").strip().lower()
        area = str(row.get("area_name") or "").strip()
        if pid and email and area:
            index[(area, email)] = pid
    print(f"  {len(index)} D1-rader indexerade.", flush=True)
    return index


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def write_assignments(changes: dict[str, tuple[str, set[str]]], now_ms: int) -> None:
    if not changes:
        print("Inga nämnd/organ-kopplingar att skriva.", flush=True)
        return

    statements = ["BEGIN TRANSACTION;"]
    for politician_id, (area_name, person_bodies) in changes.items():
        statements.append(
            "DELETE FROM politician_assignments "
            f"WHERE politician_id = {sql_quote(politician_id)} AND source = 'troman';"
        )
        for body in sorted(person_bodies, key=str.casefold):
            statements.append(
                "INSERT OR IGNORE INTO politician_assignments "
                "(politician_id, area_name, body, role, source, last_scraped_at) VALUES ("
                f"{sql_quote(politician_id)}, {sql_quote(area_name)}, {sql_quote(body)}, "
                f"NULL, 'troman', {now_ms});"
            )
    statements.append("COMMIT;")

    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", suffix=".sql", prefix="politiker-assignments-", delete=False
        ) as tmp:
            tmp.write("\n".join(statements) + "\n")
            tmp_path = Path(tmp.name)
        print(f"Skriver {sum(len(v[1]) for v in changes.values())} nämnd/organ-kopplingar till D1...", flush=True)
        proc = subprocess.run(
            wrangler_args() + ["--file", str(tmp_path)],
            cwd=REPO_ROOT,
        )
        if proc.returncode != 0:
            sys.exit("FEL: Wrangler kunde inte skriva nämnd/organ-data till D1.")
    finally:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)


def main() -> None:
    politician_index = load_politician_index()
    targets = [row for row in load_regioner() if row.get("typ") == "troman"]
    now_ms = int(time.time() * 1000)
    total_people = total_bodies = total_missing = 0
    changes: dict[str, tuple[str, set[str]]] = {}

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

            politician_id = None
            for email in emails:
                politician_id = politician_index.get((area_name, email))
                if politician_id:
                    break
            if not politician_id:
                area_missing += 1
                continue

            previous = changes.get(politician_id)
            body_set = set(person_bodies)
            if previous:
                body_set.update(previous[1])
            changes[politician_id] = (area_name, body_set)
            area_bodies += len(person_bodies)
            total_people += 1
            time.sleep(0.05)

        total_bodies += area_bodies
        total_missing += area_missing
        print(
            f"  {area_bodies} nämnd/organ-kopplingar hittade, "
            f"{area_missing} profiler utan D1-match",
            flush=True,
        )

    write_assignments(changes, now_ms)
    print(
        f"\nKlart: {total_people} personer, {total_bodies} nämnd/organ-kopplingar, "
        f"{total_missing} profiler utan D1-match.",
        flush=True,
    )


if __name__ == "__main__":
    main()
