# kontakter/ — AI Agent Guide

Delen av politiker som fyller databasen. Repots gemensamma regler står
i rot-`CLAUDE.md`; det här dokumentet gäller `kontakter/` och alla sökvägar
nedan är relativa hit.

Scraper som hämtar publikt publicerade e-postadresser till förtroendevalda
(kommunfullmäktige och regionfullmäktige) i Sveriges 290 kommuner och 21
regioner. Sparar resultatet som VCF-filer (för import till t.ex. iPhone-
kontakter) och en alfabetiskt sorterad textfil.

## Tech Stack

- Python 3, Playwright (headless Chromium)
- `pypdf` för PDF-baserade ledamotslistor
- Docker / Docker Compose

## Dev Commands

```bash
cp .env.example .env
# Justera OUTPUT_DIR/LOG_DIR i .env
docker compose up
```

## Project Structure

```
scraper/scraper.py       # Huvudlogik — alla scrape_*-funktioner
scraper/regioner.json    # Regionkonfig (namn/typ/URL per kommun/region) — data, ej kod
scraper/politiker_common.py # Delade parti-/namnhjälpare (scraper + backfill)
scraper/d1.py            # Delad Cloudflare D1-klient för alla sync/export/verify-skript
scraper/Dockerfile       # Bygger scrapern
scraper/entrypoint.sh
docker-compose.yml
UNSUPPORTED_KOMMUNER.md # Kommuner som saknar stöd/känt register
```

Alla skript som pratar med D1 (`sync_*`, `fetch_*`, `backfill_*`, `export_d1`,
`verify_emails`) går via `scraper/d1.py` (`D1Client`). Miljövariabler läses där:
`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN_POLITIKER` (alias
`CLOUDFLARE_API_TOKEN`), `D1_DATABASE_UUID` (alias `D1_DATABASE_ID`).

## Datamodell

Varje `scrape_*`-funktion returnerar en `set()` av `(namn, email, parti, roll)`-
tupler (namn kan vara tom sträng om inget namn gick att extrahera). `main()`
samlar detta per kommun/region i `alla_people` och skriver:
- `.vcf` per region + `Alla_regioner.vcf` (mobilimport)
- `Alla_kommuner_och_regioner.txt` — människoläsbar, svensk sortering (`swedish_key()`)
- `Alla_kommuner_och_regioner.csv` — **maskinläsbar överföringsform**, det enda
  format `sync_to_d1.py` läser (.txt:en parsas inte längre). Kolumnen `source`
  är `pattern-guess` för adresser byggda från ett namnmönster (typ
  `namnmonster`/`namnlista`), annars `scraped`.
- `gissade_adresser.txt` — listar just de mönster-gissade adresserna för översyn.

## Publicerad data

`data/` innehåller den fullständiga kontaktdatabasen (csv/json/sql), genererad
ur politikers live-D1 av `export/export_d1.py` och
`../.github/workflows/export-politiker.yml` (veckovis, auto-mergad PR). Endast
stabila fält exporteras (inga tidsstämplar) så diffarna inte brusar. VCF
committas inte längre — scrapern producerar dem fortfarande lokalt.

## Lägga till kommuner/regioner

Lägg till en post i `scraper/regioner.json` med kommunens/regionens
fullmäktigesida och rätt `"typ"` (`mailto`, `netpublicator`, `troman`,
`w3d3`, `fmr`, `profilsidor`, `namnmonster`, `pdf`, `namnlista`) beroende på
hur ledamotslistan är publicerad. `scraper.py` och `backfill_kommun_role_party.py`
läser båda samma JSON-fil.

## Conventions

- Inga inloggningsuppgifter eller hemligheter hanteras — all data är redan
  offentligt publicerad av kommunerna/regionerna själva
- Skärp aldrig TLS-validering (`ignore_https_errors` etc.) i den committade
  `scraper.py` — sådana workarounds hör endast hemma i lokala testkopior
- Långa körningar (alla 273 poster) bör checkpointa namn+e-post per region,
  inte bara skriva slutfilen efter att hela listan är klar
