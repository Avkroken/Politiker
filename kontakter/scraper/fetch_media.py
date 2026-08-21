#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Synkar redaktionella kontaktvägar för fem stora svenska nyhetsorganisationer.

Princip:
- area_type='media' ger en egen huvudkategori i appen.
- area_name är mediehuset.
- role skiljer Nyhetsredaktion, Politik, Granskning, Ledare/opinion m.m.
- Officiella funktionsadresser prioriteras.
- Om en viktig avdelning saknar funktionsadress hämtas offentligt publicerade
  yrkesadresser från mediehusets egna aktuella sidor när det går.
- Inga adresser gissas från namn om inte mediehuset självt uttryckligen publicerar
  ett adressmönster för just den redaktionen.

Källor verifierade 2026-08-21. Dynamiska personalsidor skrapas där de är stabila;
funktionsadresser ligger som verifierade fallbacks så en layoutändring inte
raderar en hel redaktion ur databasen.
"""
from __future__ import annotations

import html
import re
import sys
import time
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import requests

from d1 import D1Client

UA = {"User-Agent": "politiker-contact-refresh/1.0 (+https://github.com/blixten85/politiker)"}
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
HREF_RE = re.compile(r'href=["\']([^"\']+)["\']', re.I)


@dataclass(frozen=True)
class Contact:
    name: str
    email: str
    organisation: str
    role: str
    source: str


STATIC_CONTACTS = [
    # SVT
    Contact("SVT Nyheter", "svtnyheter@svt.se", "SVT", "Nyhetsredaktion", "https://www.svt.se/nyheter/inrikes/sa-kontaktar-du-svt-nyheter"),
    Contact("SVT Politik", "tipsapolitik@svt.se", "SVT", "Politik", "https://www.svt.se/nyheter/inrikes/senaste-nytt-om-val-2026"),
    Contact("Morgonstudion", "morgonstudion@svt.se", "SVT", "Nyhetsredaktion", "https://www.svt.se/nyheter/inrikes/sa-kontaktar-du-svt-nyheter"),
    Contact("SVT Nyheter grävdesk", "tips@svt.se", "SVT", "Granskning", "https://www.svt.se/nyheter/granskning/tipsa-svt-nyheter"),
    Contact("Uppdrag granskning", "granskning@svt.se", "SVT", "Granskning", "https://www.svt.se/nyheter/granskning/ug/kontakta-uppdrag-granskning"),
    # Sveriges Radio
    Contact("Ekot", "ekot@sverigesradio.se", "Sveriges Radio/Ekot", "Nyhetsredaktion / Politik", "https://www.sverigesradio.se/grupp/11079"),
    # TV4
    Contact("TV4 Nyheterna", "nyheterna@tv4.se", "TV4", "Nyhetsredaktion / Politik", "https://commercial.tv4.se/kontakta-oss/"),
    Contact("Kalla fakta", "kalla.fakta@tv4.se", "TV4", "Granskning", "https://commercial.tv4.se/kontakta-oss/"),
    # Aftonbladet
    Contact("Aftonbladet Tipsa", "tipsa@aftonbladet.se", "Aftonbladet", "Nyhetstips", "https://www.aftonbladet.se/tipsa"),
    Contact("Aftonbladet Debatt", "debatt@aftonbladet.se", "Aftonbladet", "Ledare/opinion", "https://www.aftonbladet.se/omaftonbladet"),
    Contact("Anders Lindberg", "anders.lindberg@aftonbladet.se", "Aftonbladet", "Ledare/opinion – politisk chefredaktör", "https://www.aftonbladet.se/omaftonbladet/a/K39kjy/aftonbladets-redaktionsledning-och-ledningsgrupp"),
    Contact("Jonathan Jeppsson", "jonathan.jeppsson@aftonbladet.se", "Aftonbladet", "Granskning / Samhälle", "https://www.aftonbladet.se/omaftonbladet/a/K39kjy/aftonbladets-redaktionsledning-och-ledningsgrupp"),
    Contact("Jonna Sima", "jonna.sima@aftonbladet.se", "Aftonbladet", "Ledare/opinion – redaktionssekreterare", "https://www.aftonbladet.se/omaftonbladet/a/P9d1d0/om-ledare"),
    # Expressen
    Contact("Expressen redaktionen", "redaktionen@expressen.se", "Expressen", "Nyhetsredaktion / Politik", "https://www.expressen.se/"),
    Contact("Expressen Tipsa", "tipsa@expressen.se", "Expressen", "Nyhetstips", "https://www.expressen.se/"),
    Contact("Expressen Ledare", "ledare@expressen.se", "Expressen", "Ledare/opinion", "https://extra.expressen.se/pdf/Almedalen120701.pdf"),
]

UG_URL = "https://www.svt.se/nyheter/granskning/ug/kontakta-uppdrag-granskning"

# Avdelningssidor där vi kan plocka upp aktuella publicerade yrkesadresser utan
# att hårdkoda gamla namn. Resultatet är ett komplement till funktionsadresserna.
SECTION_PAGES = [
    ("https://www.aftonbladet.se/omaftonbladet/a/K39kjy/aftonbladets-redaktionsledning-och-ledningsgrupp", "Aftonbladet", "Redaktionsledning", "aftonbladet.se"),
    ("https://www.aftonbladet.se/omaftonbladet/a/P9d1d0/om-ledare", "Aftonbladet", "Ledare/opinion", "aftonbladet.se"),
    ("https://www.sverigesradio.se/grupp/11079", "Sveriges Radio/Ekot", "Politik", "sverigesradio.se"),
]

UPSERT_SQL = (
    "INSERT INTO politicians (id, name, email, area_name, area_type, party, role, last_scraped_at) "
    "VALUES (lower(hex(randomblob(11))), ?, ?, ?, 'media', NULL, ?, ?) "
    "ON CONFLICT(email, area_name) DO UPDATE SET name=excluded.name, role=excluded.role, "
    "last_scraped_at=excluded.last_scraped_at"
)


def fetch_html(url: str) -> str:
    r = requests.get(url, headers=UA, timeout=30)
    r.raise_for_status()
    return r.text


def visible_text(raw_html: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "\n", raw_html))


def display_name_from_email(email: str) -> str:
    local = email.split("@", 1)[0]
    if "." not in local:
        return email
    return " ".join(part.replace("-", "-").capitalize() for part in local.split("."))


def scrape_ug() -> list[Contact]:
    """Hämta hela aktuella UG-redaktionen direkt från SVT:s kontaktsida."""
    try:
        text = visible_text(fetch_html(UG_URL))
    except Exception as exc:
        print(f"VARNING: kunde inte läsa Uppdrag granskning: {exc}", file=sys.stderr)
        return []
    lines = [re.sub(r"\s+", " ", x).strip() for x in text.splitlines() if x.strip()]
    rows: list[Contact] = []
    for i, line in enumerate(lines):
        m = EMAIL_RE.search(line)
        if not m or not m.group(0).lower().endswith("@svt.se"):
            continue
        email = m.group(0).lower()
        context = " ".join(lines[max(0, i - 1): i + 1])
        before = context.split(email, 1)[0].strip(" ,-:")
        role_match = re.search(
            r"\b(ansvarig utgivare|programredaktör|planeringsredaktör|publiceringsredaktör|"
            r"nyhetsredaktör|redaktör och researcher|redaktör|reporter|programredigerare)\b",
            before,
            re.I,
        )
        if not role_match:
            continue
        name = before[:role_match.start()].strip(" ,-:").split("Foto:")[-1].strip()
        role = role_match.group(1).strip().capitalize()
        if 2 <= len(name.split()) <= 5:
            rows.append(Contact(name, email, "SVT", f"Granskning – Uppdrag granskning ({role})", UG_URL))
    return rows


def scrape_public_emails(url: str, organisation: str, role: str, domain: str) -> list[Contact]:
    """Extrahera endast adresser som faktiskt publiceras på den officiella sidan."""
    try:
        text = visible_text(fetch_html(url))
    except Exception as exc:
        print(f"VARNING: kunde inte läsa {url}: {exc}", file=sys.stderr)
        return []
    rows = []
    for email in sorted({m.group(0).lower() for m in EMAIL_RE.finditer(text)}):
        if not email.endswith("@" + domain):
            continue
        # Generiska funktionsadresser finns redan i STATIC_CONTACTS och ska inte
        # skapa dubletter med ett mer specifikt person-rollvärde här.
        if email.split("@", 1)[0] in {"tipsa", "redaktionen", "ekot", "debatt", "ledare"}:
            continue
        rows.append(Contact(display_name_from_email(email), email, organisation, role, url))
    return rows


def scrape_recent_section_authors(section_url: str, organisation: str, role: str, domain: str, max_articles: int = 20) -> list[Contact]:
    """Följ aktuella artiklar från en officiell avdelningssida och samla bara
    yrkesadresser som publiceras i artikel-HTML:n. Ingen adress konstrueras."""
    try:
        page = fetch_html(section_url)
    except Exception as exc:
        print(f"VARNING: kunde inte läsa sektion {section_url}: {exc}", file=sys.stderr)
        return []
    host = urlparse(section_url).netloc
    links: list[str] = []
    seen: set[str] = set()
    for href in HREF_RE.findall(page):
        url = urljoin(section_url, html.unescape(href))
        parsed = urlparse(url)
        if parsed.netloc != host or url in seen or url == section_url:
            continue
        seen.add(url)
        links.append(url)
        if len(links) >= max_articles:
            break
    rows: list[Contact] = []
    for url in links:
        try:
            raw = fetch_html(url)
        except Exception:
            continue
        for email in sorted({m.group(0).lower() for m in EMAIL_RE.finditer(visible_text(raw))}):
            if email.endswith("@" + domain):
                rows.append(Contact(display_name_from_email(email), email, organisation, role, url))
    return rows


def dedupe(rows: list[Contact]) -> list[Contact]:
    # Databasen har en rad per (email, organisation). Om samma adress hittas i
    # flera roller väljs den mest specifika rollen i prioriteringsordning.
    priority = {"Politik": 6, "Granskning": 5, "Ledare/opinion": 4, "Redaktionsledning": 3, "Nyhetsredaktion": 2, "Nyhetstips": 1}
    out: dict[tuple[str, str], Contact] = {}
    for c in rows:
        key = (c.email.lower(), c.organisation)
        current = out.get(key)
        score = max((v for k, v in priority.items() if k in c.role), default=0)
        current_score = max((v for k, v in priority.items() if current and k in current.role), default=0)
        if current is None or score > current_score:
            out[key] = c
    return sorted(out.values(), key=lambda c: (c.organisation, c.role, c.name))


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    rows = list(STATIC_CONTACTS)
    rows.extend(scrape_ug())
    for page, org, role, domain in SECTION_PAGES:
        rows.extend(scrape_public_emails(page, org, role, domain))

    # För mediehus vars politikredaktion saknar en tydlig funktionsadress får
    # aktuella artikelbylines komplettera listan när yrkesmejl faktiskt publiceras.
    rows.extend(scrape_recent_section_authors("https://www.expressen.se/nyheter/politik/", "Expressen", "Politik", "expressen.se"))
    rows.extend(scrape_recent_section_authors("https://www.aftonbladet.se/nyheter/politik", "Aftonbladet", "Politik", "aftonbladet.se"))

    rows = dedupe(rows)
    print(f"Nyhetsredaktioner: {len(rows)} kontakter")
    for org in sorted({r.organisation for r in rows}):
        print(f"  {org}: {sum(r.organisation == org for r in rows)}")
    if dry_run:
        for c in rows:
            print(f"  {c.organisation:<22} {c.role:<46} {c.name} <{c.email}>")
        return

    client = D1Client()
    now_ms = int(time.time() * 1000)
    ok = fail = 0
    for c in rows:
        try:
            client.run(UPSERT_SQL, [c.name, c.email, c.organisation, c.role, now_ms])
            ok += 1
        except Exception as exc:
            print(f"FEL {c.name} <{c.email}>: {exc}", file=sys.stderr)
            fail += 1
    print(f"Synkat media till D1: {ok} ok, {fail} fel")


if __name__ == "__main__":
    main()
