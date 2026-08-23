# Politiker-kontakter

`kontakter/` hämtar offentligt publicerade kontaktuppgifter till politiska företrädare i svenska kommuner och regioner samt från bland annat Europaparlamentet, Riksdagen och regeringen. Resultatet synkas till D1-databasen som används av Politikerkontakt.

## Datamodell

Mottagardatan hålls medvetet liten. För en politiker sparas endast det som behövs för att hitta och välja mottagare:

- namn och e-postadress,
- politisk nivå och geografiskt område,
- parti när det kan fastställas,
- nämnd/organ som separat koppling när källan erbjuder tillförlitlig information.

Detaljerade befattningar som ledamot, ersättare, suppleant, ordförande, sekreterare och liknande används inte som huvuddata eller mottagarfilter. Nämnd/organ lagras separat eftersom samma person kan tillhöra flera organ.

## Publicerad data

Den exporterade kontaktdatabasen finns i `data/` som CSV, JSON och SQL. Filerna genereras ur live-D1 av `.github/workflows/export-politiker.yml`; workflowen exporterar databasen men kör inte själva webbskrapningen.

För en egen installation skapas grundschemat via `infra/setup.sh`/`infra/schema.sql`; därefter kan exporten importeras med Wrangler.

## Kontaktkort till mobilen

VCF genereras lokalt ur `data/politiker.csv` och committas inte:

```bash
python3 export/to_vcf.py
python3 export/to_vcf.py --area "Lysekils kommun"
python3 export/to_vcf.py --type riksdag
python3 export/to_vcf.py --per-area
```

Utdata skrivs till `vcf/`.

## Kända täckningsbegränsningar

Alla kommuner kan inte skrapas tillförlitligt. `UNSUPPORTED_KOMMUNER.md` dokumenterar kommuner där en komplett, namngiven lista med faktiska publicerade e-postadresser inte har kunnat verifieras.

Region- och kommunkällor är externa system och kan ändras eller börja blockera automatiserad hämtning. Täckningen ska därför bedömas från aktuell exporterad data och aktuella scraperkörningar.

## Köra scrapern

```bash
cp .env.example .env
# Justera OUTPUT_DIR och övriga lokala värden i .env
docker compose up
```

Scrapern skriver bland annat `Alla_kommuner_och_regioner.csv`, som används av `sync_to_d1.py`, samt lokala gransknings- och VCF-filer.

## Struktur

- `scraper/scraper.py` — huvudlogik för kommuner och regioner.
- `scraper/regioner.json` — källkonfiguration för kommuner och regioner.
- `scraper/d1.py` — gemensam D1-klient.
- `scraper/politiker_common.py` — parti- och namnhjälpare.
- `scraper/fetch_eu_meps.py` — Europaparlamentariker.
- `scraper/fetch_riksdagen_members.py` — riksdagsledamöter.
- `scraper/sync_regeringen.py` — regering/departement.
- `scraper/sync_party_from_val.py` — kompletterar parti från Valmyndighetens data.
- `scraper/sync_to_d1.py` — synkar namn/e-post/område/nivå/parti till `politicians`.
- `scraper/backfill_assignments.py` — kompletterar nämnd/organ utan att spara detaljroller.
- `export/` — exportverktyg, bland annat CSV/JSON/SQL och VCF.

## Lägga till eller rätta en källa

Ändra posten i `scraper/regioner.json` och välj en scraperstrategi som motsvarar hur källan faktiskt publicerar politikerna. Fokus ska vara identitet, kontaktuppgift, område/nivå, parti och vid behov nämnd/organ — inte detaljerade befattningstitlar. När en tidigare osupportad kommun får en verifierbar komplett källa ska även `UNSUPPORTED_KOMMUNER.md` uppdateras.
