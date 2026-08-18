# Politiker-kontakter

Scraper som hämtar e-postadresser till förtroendevalda i svenska regioner och
kommuner (samt EU-parlamentet, riksdagen och departementen), och synkar till
D1-databasen som driver [politiker-webapp](https://politiker.denied.se).

## Publicerad data

Hela kontaktdatabasen publiceras i [`data/`](data/) — namn, e-post, område,
områdestyp, parti och befattning för samtliga ~17 000 folkvalda:

| Fil | Format | Användning |
| --- | --- | --- |
| `data/politiker.csv` | CSV | Kanonisk, människoläsbar — öppnas i Excel/pandas/osv |
| `data/politiker.json` | JSON | Programmatisk användning |
| `data/politiker.sql` | SQL (`INSERT OR IGNORE`) | Direktimport till en egen D1 |

Filerna genereras direkt ur live-D1:n (read-only) av
[`.github/workflows/export-politiker.yml`](../.github/workflows/export-politiker.yml),
som veckovis öppnar en auto-mergad PR när datan ändrats. Ingen extern skrapning
sker i den workflowen — den läser bara den redan publika databasen.

Importera till en egen politiker-webapp-kopia (efter `infra/schema.sql`):

```bash
wrangler d1 execute <din-db> --remote --file data/politiker.sql
```

### Kontaktkort till mobilen (VCF)

Vill du lägga in kontakterna i telefonen genereras VCF **på begäran** ur den
lokala `data/politiker.csv` — ingen belastning på sidan eller databasen. Filtrera
så du bara får det du vill ha och importera `.vcf`-filen i telefonens kontakter:

```bash
python3 export/to_vcf.py                          # alla i en samlad fil
python3 export/to_vcf.py --area "Lysekils kommun" # bara en kommun
python3 export/to_vcf.py --type riksdag           # hela riksdagen
python3 export/to_vcf.py --per-area               # en fil per område
```

Filerna skrivs till `vcf/` (committas inte). Detta ersätter de tidigare
hårdkodade VCF-filerna i repot.

## Regioner utan data (2026-08-18)

Skrapan är konfigurerad för alla 21 regioner i `scraper/regioner.json`, men
två av dem ger noll poster i produktionsdatabasen. Det är inte en
dokumenterad begränsning som i [`UNSUPPORTED_KOMMUNER.md`](UNSUPPORTED_KOMMUNER.md)
— det är konfiguration som slutat fungera, och den syntes inte förrän
täckningen mättes per region i stället för som en totalsumma.

| Region | Konfiguration | Uppmätt |
| --- | --- | --- |
| Region Örebro län | `typ: "mailto"` mot `regionorebrolan.tromanpublik.se/` | Källan svarar **500**. Dessutom fel strategi: alla andra Troman-regioner använder `typ: "troman"` mot en `/organisation/<uuid>`-URL, och rot-URL:en har inga mailto-länkar att skrapa även när den svarar. |
| Region Skåne | `typ: "mailto"` mot `skane.se/.../regionfullmaktige/` | Källan svarar **403** på en vanlig HTTP-hämtning (456 byte, ser ut som ett WAF-svar). Kan mycket väl fungera från Playwrights riktiga webbläsare — det behöver provas från en miljö med fungerande browser innan URL:en döms ut. |

Vad det betyder för sajten: den som bor i Skåne eller Örebro län väljer sin
region och får ingen att kontakta. Tillsammans är det drygt 1,7 miljoner
invånare.

Hälsokontrollen (`healthcheck/`) larmar numera på detta — se
`checkRegionCoverage`. Tidigare rapporterades bara totalen ("17 196 politiker
i databasen"), som såg fullt trovärdig ut medan två regioner var tomma.

## Köra scrapern själv

```bash
cp .env.example .env
# Justera OUTPUT_DIR i .env
docker compose up
```

Scrapern skriver till `OUTPUT_DIR`:

- VCF-filer (en per region + en samlad)
- `Alla_kommuner_och_regioner.txt` — människoläsbar lista
- `Alla_kommuner_och_regioner.csv` — maskinläsbar; det format `sync_to_d1.py`
  läser vid synk till D1. Kolumnen `source` är `pattern-guess` för adresser som
  byggts från ett namnmönster (kan vara felaktiga), annars `scraped`
- `gissade_adresser.txt` — just de mönster-gissade adresserna, för översyn

## Struktur

- `scraper/scraper.py` – huvudlogik, Playwright-baserad
- `scraper/regioner.json` – regionkonfigurationen (namn/typ/URL per kommun och
  region) — ren data, läses av både scrapern och backfill-skriptet
- `scraper/d1.py` – delad Cloudflare D1-klient som alla sync-/export-/verify-
  skript går via
- `scraper/politiker_common.py` – delade parti-/namnhjälpare
- `scraper/fetch_eu_meps.py` – EU-parlamentariker (namn, parti, utskottsbefattning)
- `scraper/fetch_riksdagen_members.py` – riksdagsledamöter
- `scraper/sync_regeringen.py` – departementens registratorsadresser
- `scraper/backfill_kommun_role_party.py` – engångs-/återkörbar bakfyllning av
  befattning+parti för kommun/region via troman/netpublicator-källornas
  ledamotslistor (samma datakälla som `scraper.py`, separat steg eftersom det
  görs per person istället för per region)
- `scraper/backfill_riksdagen_role.py` – motsvarande bakfyllning för riksdagen
- `scraper/sync_party_from_val.py` – matchar parti mot Valmyndighetens öppna data
  där det inte går att fastställa direkt vid skrapning
- `scraper/sync_to_d1.py` – upsert av scraperns CSV-resultat till
  politiker-webapps D1-databas (`politicians`-tabellen)
- `scraper/Dockerfile` – bygger scrapern
- `docker-compose.yml` – kör allt

## Lägga till kommuner

Lägg till en post i `scraper/regioner.json` med kommunens fullmäktigesida och
rätt `"typ"` (se CLAUDE.md för fälten per typ).
