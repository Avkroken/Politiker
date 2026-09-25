#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Synkar ett kurerat urval akademiska offentliga yrkeskontakter till D1.

Endast e-postadresser som uttryckligen publiceras av lärosätet används.
Adresser konstrueras aldrig från namn eller kända adressmönster.

Kärnområden:
- statsvetenskap
- offentlig förvaltning
- offentlig rätt / förvaltningsrätt

Varje post behåller sin officiella käll-URL för spårbarhet. Källorna ska
omprövas när urvalet ändras; e-postverifieringen hanterar leveransstatus separat.

Skriptet kan antingen skriva direkt via D1 HTTP-klienten eller generera en
idempotent SQL-fil för Wrangler/GitHub Actions med --sql-file.
"""
from __future__ import annotations

import argparse
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

POLITICAL_SCIENCE = "political-science"
PUBLIC_ADMINISTRATION = "public-administration"
PUBLIC_LAW = "public-law"
ACADEMIC_FIELDS = {POLITICAL_SCIENCE, PUBLIC_ADMINISTRATION, PUBLIC_LAW}

UPPSALA_POLITICAL_SCIENCE = "https://www.uu.se/kontakt-och-organisation/organisation?query=HS13%3A1"
GU_ELECTION_EXPERTS = "https://www.gu.se/pressrum/expertarkivet/experter-val-valjare-och-politik"
GU_JENNY_DE_FINE_LICHT = "https://www.gu.se/om-universitetet/hitta-person/jennydefinelicht"
UPPSALA_LAW_PRESS = "https://www.uu.se/institution/juridiska/for-press"
UPPSALA_LOTTA_LERWALL = "https://www.uu.se/kontakt-och-organisation/personal?query=N5-842"
UPPSALA_TIM_HOLAPPA = "https://www.uu.se/kontakt-och-organisation/personal?query=N24-2071"


@dataclass(frozen=True)
class AcademicContact:
    name: str
    email: str
    organisation: str
    unit: str
    title: str
    academic_field: str
    source_url: str


CONTACTS = [
    AcademicContact("Per Adman", "per.adman@statsvet.uu.se", "Uppsala universitet", "Statsvetenskapliga institutionen", "Universitetslektor", POLITICAL_SCIENCE, UPPSALA_POLITICAL_SCIENCE),
    AcademicContact("Shirin Ahlbäck Öberg", "shirin.ahlback@statsvet.uu.se", "Uppsala universitet", "Statsvetenskapliga institutionen", "Professor", POLITICAL_SCIENCE, UPPSALA_POLITICAL_SCIENCE),
    AcademicContact("Rafael Ahlskog", "rafael.ahlskog@statsvet.uu.se", "Uppsala universitet", "Statsvetenskapliga institutionen", "Forskare", POLITICAL_SCIENCE, UPPSALA_POLITICAL_SCIENCE),
    AcademicContact("Anton Ahlén", "anton.ahlen@statsvet.uu.se", "Uppsala universitet", "Statsvetenskapliga institutionen", "Postdoktor", POLITICAL_SCIENCE, UPPSALA_POLITICAL_SCIENCE),
    AcademicContact("Anahita Assadi", "anahita.assadi@statsvet.uu.se", "Uppsala universitet", "Statsvetenskapliga institutionen", "Postdoktor", POLITICAL_SCIENCE, UPPSALA_POLITICAL_SCIENCE),
    AcademicContact("Li Bennich-Björkman", "li.bennich-bjorkman@statsvet.uu.se", "Uppsala universitet", "Statsvetenskapliga institutionen", "Professor", POLITICAL_SCIENCE, UPPSALA_POLITICAL_SCIENCE),
    AcademicContact("Elin Bjarnegård", "elin.bjarnegard@statsvet.uu.se", "Uppsala universitet", "Statsvetenskapliga institutionen", "Professor", POLITICAL_SCIENCE, UPPSALA_POLITICAL_SCIENCE),
    AcademicContact("Paula Blomqvist", "paula.blomqvist@statsvet.uu.se", "Uppsala universitet", "Statsvetenskapliga institutionen", "Professor", POLITICAL_SCIENCE, UPPSALA_POLITICAL_SCIENCE),
    AcademicContact("Dolores Calvo", "dolores.calvo@statsvet.uu.se", "Uppsala universitet", "Statsvetenskapliga institutionen", "Forskare", POLITICAL_SCIENCE, UPPSALA_POLITICAL_SCIENCE),
    AcademicContact("Axel Cronert", "axel.cronert@statsvet.uu.se", "Uppsala universitet", "Statsvetenskapliga institutionen", "Biträdande universitetslektor", POLITICAL_SCIENCE, UPPSALA_POLITICAL_SCIENCE),
    AcademicContact("Mikael Persson", "mikael.persson.3@gu.se", "Göteborgs universitet", "Statsvetenskapliga institutionen", "Professor", POLITICAL_SCIENCE, GU_ELECTION_EXPERTS),
    AcademicContact("Aksel Sundström", "aksel.sundstrom@pol.gu.se", "Göteborgs universitet", "Statsvetenskapliga institutionen", "Professor", POLITICAL_SCIENCE, GU_ELECTION_EXPERTS),
    AcademicContact("Johannes Lindvall", "johannes.lindvall@gu.se", "Göteborgs universitet", "Statsvetenskapliga institutionen", "Professor", POLITICAL_SCIENCE, GU_ELECTION_EXPERTS),
    AcademicContact("David Karlsson", "david.karlsson@spa.gu.se", "Göteborgs universitet", "Förvaltningshögskolan", "Professor", PUBLIC_ADMINISTRATION, GU_ELECTION_EXPERTS),
    AcademicContact("Gustaf Kastberg Weichselberger", "gustaf.kastberg@spa.gu.se", "Göteborgs universitet", "Förvaltningshögskolan", "Professor", PUBLIC_ADMINISTRATION, GU_ELECTION_EXPERTS),
    AcademicContact("Jenny de Fine Licht", "jenny.definelicht@spa.gu.se", "Göteborgs universitet", "Förvaltningshögskolan", "Professor", PUBLIC_ADMINISTRATION, GU_JENNY_DE_FINE_LICHT),
    AcademicContact("Anna-Sara Lind", "anna-sara.lind@jur.uu.se", "Uppsala universitet", "Juridiska institutionen", "Professor i offentlig rätt", PUBLIC_LAW, UPPSALA_LAW_PRESS),
    AcademicContact("Moa Dahlin", "moa.k.dahlin@jur.uu.se", "Uppsala universitet", "Juridiska institutionen", "Universitetslektor i offentlig rätt", PUBLIC_LAW, UPPSALA_LAW_PRESS),
    AcademicContact("Therése Fridström Montoya", "therese.f.montoya@jur.uu.se", "Uppsala universitet", "Juridiska institutionen", "Jur. dr i offentlig rätt", PUBLIC_LAW, UPPSALA_LAW_PRESS),
    AcademicContact("Lotta Lerwall", "lotta.lerwall@jur.uu.se", "Uppsala universitet", "Juridiska institutionen", "Professor i förvaltningsrätt", PUBLIC_LAW, UPPSALA_LOTTA_LERWALL),
    AcademicContact("Olle Lundin", "olle.lundin@jur.uu.se", "Uppsala universitet", "Juridiska institutionen", "Professor i förvaltningsrätt", PUBLIC_LAW, UPPSALA_LAW_PRESS),
    AcademicContact("Tim Holappa", "tim.holappa@jur.uu.se", "Uppsala universitet", "Juridiska institutionen", "Universitetslektor i förvaltningsrätt", PUBLIC_LAW, UPPSALA_TIM_HOLAPPA),
]

ALLOWED_EMAIL_DOMAINS = {
    "statsvet.uu.se",
    "jur.uu.se",
    "gu.se",
    "pol.gu.se",
    "spa.gu.se",
}
ALLOWED_SOURCE_DOMAINS = {"www.uu.se", "www.gu.se"}


UPSERT_SQL = (
    "INSERT INTO public_contacts "
    "(id, name, email, area_name, area_type, party, role, last_scraped_at, "
    "organisation, unit, title, academic_field, source_url) "
    "VALUES (lower(hex(randomblob(11))), ?, ?, ?, 'academia', NULL, ?, ?, ?, ?, ?, ?, ?) "
    "ON CONFLICT(email, area_name) DO UPDATE SET "
    "name=excluded.name, role=excluded.role, last_scraped_at=excluded.last_scraped_at, "
    "organisation=excluded.organisation, unit=excluded.unit, title=excluded.title, "
    "academic_field=excluded.academic_field, source_url=excluded.source_url"
)


def validate_contact(contact: AcademicContact) -> None:
    email = contact.email.strip().lower()
    if email != contact.email:
        raise ValueError(f"E-post måste vara normaliserad: {contact.email}")
    if email.count("@") != 1:
        raise ValueError(f"Ogiltig e-postadress: {contact.email}")
    domain = email.rsplit("@", 1)[1]
    if domain not in ALLOWED_EMAIL_DOMAINS:
        raise ValueError(f"Icke godkänd universitetsdomän: {domain}")
    if contact.academic_field not in ACADEMIC_FIELDS:
        raise ValueError(f"Okänt akademiskt område: {contact.academic_field}")
    source = urlparse(contact.source_url)
    if source.scheme != "https" or source.netloc not in ALLOWED_SOURCE_DOMAINS:
        raise ValueError(f"Ogiltig officiell källa: {contact.source_url}")
    if not all((contact.name, contact.organisation, contact.unit, contact.title)):
        raise ValueError(f"Ofullständig akademisk kontakt: {contact.email}")


def validated_contacts() -> list[AcademicContact]:
    seen: set[tuple[str, str]] = set()
    rows: list[AcademicContact] = []
    for contact in CONTACTS:
        validate_contact(contact)
        key = (contact.email, contact.organisation)
        if key in seen:
            raise ValueError(f"Duplicerad akademisk kontakt: {contact.email} / {contact.organisation}")
        seen.add(key)
        rows.append(contact)
    return rows


def sql_literal(value: str | int | None) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, int):
        return str(value)
    return "'" + value.replace("'", "''") + "'"


def academic_upsert_statement(contact: AcademicContact, now_ms: int) -> str:
    values = [
        contact.name,
        contact.email,
        contact.organisation,
        contact.title,
        now_ms,
        contact.organisation,
        contact.unit,
        contact.title,
        contact.academic_field,
        contact.source_url,
    ]
    rendered = ", ".join(sql_literal(value) for value in values)
    return (
        "INSERT INTO public_contacts "
        "(id, name, email, area_name, area_type, party, role, last_scraped_at, "
        "organisation, unit, title, academic_field, source_url) VALUES "
        f"(lower(hex(randomblob(11))), {rendered.split(', ', 3)[0]}, "
        f"{rendered.split(', ', 3)[1]}, {rendered.split(', ', 3)[2]}, 'academia', NULL, "
        f"{', '.join(rendered.split(', ')[3:])}) "
        "ON CONFLICT(email, area_name) DO UPDATE SET "
        "name=excluded.name, role=excluded.role, last_scraped_at=excluded.last_scraped_at, "
        "organisation=excluded.organisation, unit=excluded.unit, title=excluded.title, "
        "academic_field=excluded.academic_field, source_url=excluded.source_url"
    )


def write_sql_file(path: Path, rows: list[AcademicContact], now_ms: int) -> None:
    statements = [academic_upsert_statement(row, now_ms) + ";" for row in rows]
    path.write_text("BEGIN;\n" + "\n".join(statements) + "\nCOMMIT;\n", encoding="utf-8")


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__)
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Visa det kurerade urvalet utan skrivning.")
    mode.add_argument("--sql-file", type=Path, help="Skriv idempotent D1-SQL till fil i stället för HTTP-synk.")
    mode.add_argument("--count", action="store_true", help="Skriv endast antal kurerade akademikontakter.")
    return p


def main() -> None:
    args = parser().parse_args()
    rows = validated_contacts()

    if args.count:
        print(len(rows))
        return

    print(f"Akademiska kontakter: {len(rows)}")
    for field in sorted(ACADEMIC_FIELDS):
        print(f"  {field}: {sum(row.academic_field == field for row in rows)}")

    if args.dry_run:
        for row in rows:
            print(f"  {row.organisation:<24} {row.academic_field:<24} {row.name} <{row.email}>")
        return

    now_ms = int(time.time() * 1000)
    if args.sql_file:
        write_sql_file(args.sql_file, rows, now_ms)
        print(f"Skrev {len(rows)} idempotenta akademikontakter till {args.sql_file}")
        return

    from d1 import D1Client

    client = D1Client()
    ok = fail = 0
    for row in rows:
        try:
            client.run(
                UPSERT_SQL,
                [
                    row.name,
                    row.email,
                    row.organisation,
                    row.title,
                    now_ms,
                    row.organisation,
                    row.unit,
                    row.title,
                    row.academic_field,
                    row.source_url,
                ],
            )
            ok += 1
        except Exception as exc:
            print(f"FEL {row.name} <{row.email}>: {exc}")
            fail += 1

    print(f"Synkat akademi till D1: {ok} ok, {fail} fel")
    if fail:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
