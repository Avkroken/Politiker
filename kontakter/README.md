# Politiker-kontakter

`kontakter/` samlar in och normaliserar offentligt publicerade kontaktuppgifter till politiska företrädare från bland annat kommuner, regioner, Europaparlamentet, Riksdagen, regeringen, media och relevanta valda organ inom Svenska kyrkan.

## Datakälla och ansvar

Cloudflare D1 är den enda kanoniska runtime-datakällan för Politikerkontakt. Git-repot innehåller inte snapshots eller exporter av live-D1.

Insamlingsjobben är dataproducenter. De får uppdatera kontaktdata med minsta nödvändiga D1-behörighet, men de äger inte Cloudflare-provisionering, schema/migrationer eller Worker-deploy. Den kontrollplanen ligger hos Wrangler/Cloudflare Workers Builds.

## Datamodell

Mottagardatan hålls medvetet liten. För en mottagare sparas endast det som behövs för att hitta och välja mottagare:

- namn och e-postadress,
- politisk nivå och geografiskt område,
- parti när det kan fastställas,
- nämnd/organ som separat koppling när källan erbjuder tillförlitlig information.

Detaljerade befattningar används inte som huvudfilter. Kommun- och regionorgan grupperas i begripliga politiska sakområden. Media använder motsvarande princip med redaktionell inriktning.

## Uppdateringsflöde

Den kvartalsvisa helkörningen är `scraper/quarterly_refresh.sh`. Den:

1. hämtar och normaliserar externa källor,
2. synkar kontaktdata till D1,
3. kompletterar organ/parti där tillförlitliga källor finns,
4. saniterar och normaliserar den färdiga D1-datan.

Jobbet ska köras i en separat scraper-miljö med en Cloudflare API-token som endast har de rättigheter som krävs för att uppdatera den aktuella D1-databasen. Det ska inte köras som en GitHub Actions-produktionspipeline.

## Köra kommun-/regionscrapern lokalt

```bash
cp .env.example .env
# Justera OUTPUT_DIR och övriga lokala värden i .env
docker compose up
```

Scrapern producerar lokala granskningsfiler under `resultat/`. Dessa är arbetsdata för insamling och granskning, inte en kopia av produktionsdatabasen.

## Struktur

- `scraper/scraper.py` — huvudlogik för kommuner och regioner.
- `scraper/regioner.json` — källkonfiguration för kommuner och regioner.
- `scraper/d1.py` — gemensam, begränsad D1-klient för dataproducenter.
- `scraper/politiker_common.py` — parti- och namnhjälpare.
- `scraper/fetch_eu_meps.py` — Europaparlamentariker.
- `scraper/fetch_riksdagen_members.py` — riksdagsledamöter.
- `scraper/sync_regeringen.py` — regering/departement.
- `scraper/sync_party_from_val.py` — kompletterar parti från Valmyndighetens data.
- `scraper/sync_to_d1.py` — synkar kommun-/regiondata till `politicians`.
- `scraper/backfill_assignments.py` — kompletterar nämnd/organ.
- `scraper/fetch_media.py` — samlar redaktionella mediekontakter.
- `verify/` — verifieringsverktyg för kontaktdata.

## Kända täckningsbegränsningar

Alla kommuner kan inte skrapas tillförlitligt. `UNSUPPORTED_KOMMUNER.md` dokumenterar kommuner där en komplett, namngiven lista med faktiska publicerade e-postadresser inte har kunnat verifieras.

När en källa ändras ska källkonfiguration och parser uppdateras. Git ska aldrig användas som fallback-databas eller backup av live-D1.
