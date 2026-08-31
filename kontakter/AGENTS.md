# kontakter/ — AI Agent Guide

Delen av Politiker som samlar in och underhåller offentliga mottagarkontakter. Repots gemensamma regler står i rot-`AGENTS.md`; det här dokumentet gäller `kontakter/`.

## Arkitektur

Cloudflare D1 är den enda kanoniska runtime-datakällan. `kontakter/` är en dataproducent, inte en Cloudflare-kontrollplan.

Det innebär:

- ingen export av live-D1 till Git,
- inga committade CSV/JSON/SQL-snapshots av produktionsdatabasen,
- inga GitHub Actions som skriver direkt till produktions-D1,
- ingen schema-, resurs- eller Worker-provisionering här,
- D1-skrivande hjälpskript ska använda minsta nödvändiga API-token och endast ändra kontaktdata.

## Tech stack

- Python 3
- Playwright/headless Chromium för källor som kräver webbläsare
- `pypdf` för PDF-baserade ledamotslistor
- Docker/Docker Compose för den tunga kommun-/regionscrapern

## Struktur

```text
scraper/scraper.py             huvudlogik för kommun/region
scraper/regioner.json          källkonfiguration
scraper/politiker_common.py    delade normaliseringshjälpare
scraper/d1.py                  begränsad D1-klient för kontaktdata
scraper/sync_to_d1.py          kommun/region -> D1
scraper/backfill_assignments.py organ/nämnder -> D1
scraper/fetch_*.py             övriga externa källor -> D1
scraper/quarterly_refresh.sh    orkestrerar hela kontaktuppdateringen
verify/                        verifieringsverktyg
resultat/                      lokala scraper-/granskningsartefakter
```

## D1-konfiguration

Skript som behöver D1 använder `scraper/d1.py` (`D1Client`). Kanoniska miljövariabler är:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN_POLITIKER`
- `D1_DATABASE_UUID`

Bakåtkompatibla alias får endast finnas så länge de behövs av en faktiskt verifierad körmiljö. Lägg inte till nya alias för att maskera konfigurationsdrift.

## Datamodell

Varje källa ska normaliseras till minsta användbara mottagardata: namn, e-post, område/nivå, parti när det kan verifieras samt relevant organ-/sakområdeskoppling. Råa administrativa befattningar ska inte byggas upp till egna publika filter.

Scrapern skriver lokala arbetsfiler under `resultat/`. De används för granskning/import och är inte backup eller källa till sanning för produktion.

## Uppdateringsflöde

`quarterly_refresh.sh` är den fulla kontaktuppdateringen. Den körs separat från Worker-deploy och ska inte ges rättigheter att ändra Cloudflare-resurser, Worker-konfiguration eller D1-schema.

## Konventioner

- Committera aldrig hemligheter, tokens eller produktionsdatabassnapshots.
- Föredra officiella källor och deterministisk normalisering.
- En scraper ska inte börja provisionera infrastruktur för att lösa ett datafel.
- Ändringar i D1-schema hör till repots migrationsflöde under `infra/`, inte till Python-skript här.
- Långa körningar bör checkpointa lokalt per källa/region så de kan återupptas utan att skapa en andra produktionsdatabas.
- TLS-validering får inte försvagas i committad kod.
