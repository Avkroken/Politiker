# Politiker-kontakter

`kontakter/` hämtar offentligt publicerade kontaktuppgifter till förtroendevalda i svenska kommuner och regioner samt från bland annat Europaparlamentet, Riksdagen och regeringen. Resultatet synkas till den D1-databas som används av [Politikerkontakt](https://politiker.denied.se).

## Publicerad data

Den exporterade kontaktdatabasen finns i `data/`:

| Fil | Format | Användning |
| --- | --- | --- |
| `data/politiker.csv` | CSV | Människoläsbar och enkel att använda i exempelvis Excel/pandas |
| `data/politiker.json` | JSON | Programmatisk användning |
| `data/politiker.sql` | SQL | Import till en egen D1-databas |

Filerna genereras ur live-D1 av `.github/workflows/export-politiker.yml`. Workflowen läser databasen och uppdaterar exportfilerna när innehållet har ändrats; den kör inte själva webbskrapningen.

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

Alla kommuner kan inte skrapas tillförlitligt. `UNSUPPORTED_KOMMUNER.md` dokumenterar de kommuner där en komplett, namngiven lista med faktiska publicerade e-postadresser inte har kunnat verifieras.

Region- och kommunkällor är externa system och kan ändras eller börja blockera automatiserad hämtning. Täckningen ska därför bedömas från aktuell exporterad data och aktuella scraperkörningar; repot har inte längre någon separat `healthcheck/`-Worker.

## Köra scrapern

```bash
cp .env.example .env
# Justera OUTPUT_DIR och övriga lokala värden i .env
docker compose up
```

Scrapern skriver bland annat:

- VCF-filer för lokal användning.
- `Alla_kommuner_och_regioner.txt` som människoläsbar lista.
- `Alla_kommuner_och_regioner.csv` som maskinläsbar överföringsform för `sync_to_d1.py`.
- `gissade_adresser.txt` för adresser som byggts från namnmönster och behöver granskas.

## Struktur

- `scraper/scraper.py` — huvudlogik för kommuner och regioner.
- `scraper/regioner.json` — källkonfiguration för kommuner och regioner.
- `scraper/d1.py` — gemensam D1-klient för sync-/export-/verify-skript.
- `scraper/politiker_common.py` — delade parti- och namnhjälpare.
- `scraper/fetch_eu_meps.py` — Europaparlamentariker.
- `scraper/fetch_riksdagen_members.py` — riksdagsledamöter.
- `scraper/sync_regeringen.py` — regering/departement.
- `scraper/backfill_kommun_role_party.py` och `backfill_riksdagen_role.py` — återkörbara kompletteringar av roll/parti.
- `scraper/sync_party_from_val.py` — kompletterar parti från Valmyndighetens data.
- `scraper/sync_to_d1.py` — synkar scraperresultat till `politicians` i D1.
- `export/` — exportverktyg, bland annat CSV/JSON/SQL och VCF.

## Lägga till eller rätta en källa

Ändra posten i `scraper/regioner.json` och välj en scraperstrategi som motsvarar hur källan faktiskt publicerar ledamöterna. När en tidigare osupportad kommun får en verifierbar komplett källa ska även `UNSUPPORTED_KOMMUNER.md` uppdateras.
