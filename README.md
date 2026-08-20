# Politiker

Gratis verktyg där medborgare kan skapa konto, koppla sitt **eget** mailkonto
(Gmail/Outlook/iCloud/Yahoo/generisk SMTP, eller logga in passwordlöst med
Microsoft Graph), välja vilka folkvalda de vill kontakta, och skicka
personaliserade brev — utan att plattformen själv blir avsändare. Live på
[politiker.denied.se](https://politiker.denied.se).

## Vilka politiker finns med?

- **EU**: alla 718 ledamöter i Europaparlamentet, samtliga 27 medlemsländer, med parti
- **Riksdagen**: alla 349 nuvarande ledamöter, med parti
- **Regeringen**: 11 departement (registratorsadresser — inga personliga mailadresser till statsråd finns/publiceras)
- **Region**: alla 21 regioner
- **Kommun**: alla 290 kommuner
- **Svenska kyrkan**: kyrkovalda i kyrkostyrelsen, kyrkomötets presidium och Uppsala stiftsstyrelse (de organ som publicerar personliga mailadresser), med nomineringsgrupp

För kommun/region är parti och befattning (t.ex. "Ordförande") tillagt
där det går att fastställa — antingen direkt vid skrapning (mailto/troman/
netpublicator, ~94% av kommunerna) eller via matchning mot Valmyndighetens
öppna data om nuvarande ledamöter. Skrapningslogiken ligger i
[`kontakter/`](kontakter/) — se dess egen README.

## Repots delar

| Katalog | Vad |
| --- | --- |
| `app/` | Tjänstens Cloudflare Worker — HTTP, kö och cron i samma script |
| `shared/` | Kod som appen delar med skrapan och verktygen |
| `kontakter/` | Scrapern som fyller D1:n, och exportverktygen |

Scrapern och tjänsten låg tidigare i var sitt repo trots att de delar
databas: `kontakter/` skriver in i samma D1 som tjänsten serverar, och
`export-politiker.yml` läser tillbaka ur den. Det gav två uppsättningar
workflows och regler för en enda datakedja.

## Funktioner

- **Konto**: e-post+lösenord eller OAuth-inloggning (Google, GitHub, Microsoft), TOTP 2FA, glömt lösenord, länka fler inloggningssätt till samma konto efteråt
- **Mailkoppling**: Gmail/Outlook/iCloud/Yahoo/generisk SMTP, eller Microsoft Graph utan lösenord — med ett hårdkodat säkerhetstak (10% under leverantörens kända gräns) som användaren själv kan sänka ytterligare
- **3-stegs wizard** (mottagare → brev → granska): nivåerna (EU/riksdag/regering/region/kommun/Svenska kyrkan) väljs via stora kort med levande mottagarantal (exakt, server-deduperat via `/api/recipients/count`). En framträdande **namnsökning** högst upp låter användaren hitta en enskild politiker och rikta till eller utesluta hen. Detaljerad filtrering (enskilda områden, befattning, parti-uteslutning) ligger bakom en hopfällbar "Avancerat"-sektion — stora grupper (>30 områden) hopfällda från start, sökning forcerar alltid utfällt. Befattningar grupperas kanoniskt (allt ordförande-aktigt inkl. vice → "Ordförande"; Ledamot/Ersättare/Gruppledare) så samma roll inte listas per stavningsvariant — nivå väljs genom att kombinera befattning med områdesfiltret.
- **AI-brevutkast** (valfritt): beskriv ett ämne (eller låt AI:n själv hitta ett aktuellt) — researchar via riktig websökning och föreslår ett utkast som användaren läser igenom, redigerar och skickar under eget namn, inget skickas automatiskt
- **Brev**: HTML/textredigerare, ämnesrad (full åäö/UTF-8-stöd), bilagor (PDF/txt/doc/docx, automatisk konvertering till brevtext)
- **Beständig flerdagarskö + hastighetsbegränsning per mailkonto**: stora urval, även hela landet, dedupliceras och sparas i D1. Dagens tillåtna del skickas direkt och resten fortsätter automatiskt vid kommande schemakörningar tills jobbet är klart. Varje utskick kan få ett eget dygnstak, automatisk växling efter valfritt antal dagar och ett nytt tak därefter; allt kan ändras medan utskicket pågår. En Durable Object per mailkoppling ger sann delad sändningstakt mellan parallella utskick och dygnstaket skyddar leverantörskontot.
- **Flerspråkigt gränssnitt**: 18 språk (svenska, engelska, nordiska språk, tyska, franska, spanska, polska, turkiska, ryska, ukrainska, arabiska, persiska, somaliska, kinesiska, hindi) — automatisk detektion + manuellt val, hela gränssnittet inklusive dynamiska meddelanden
- **API-nycklar**: programmatisk åtkomst (`Authorization: Bearer <nyckel>`) som alternativ till webbläsarinloggning
- **Kontakt/FAQ**: inbyggd kontaktväg och vanliga frågor, separat från felrapportering — FAQ förklarar bland annat exakt vilken politikerdata som finns och hur mottagarfiltren kombineras
- **Admin-panel**: konton, feedback, statistik (med diagram), export (CSV/JSON) per sektion eller allt i ett — samt en separat, fristående export av politiker-listan
- **Felrapportering**: oväntade JS-fel loggas till konsolen; användaren kan rapportera via kontaktformuläret
- **Autonom kampanj** (`app/src/campaign/`): cron-driven (05–09 UTC dagligen) som självständigt hämtar nyheter från SVT, Aftonbladet, Expressen och Riksdagen, filtrerar socialt relevanta ärenden med Claude, genererar personaliserade medborgarbrev och skickar dem via Gmail till kommunpolitiker, regionpolitiker och riksdagsledamöter — utan mänsklig inblandning. Inkluderar bounce-sweep (kontaktar kommunpolitiker som inte nåtts på 90 dagar). Klientfel sparas deduplicerat i D1 och nya unika fel skickas som e-postnotiser med ett dygnstak mot spam.
- **Kvartalsbrev + nyhetsbrev**: den 1:a i varje kvartal researchar och författar campaign-Workern ETT gemensamt medborgarbrev (utifrån kvartalets bevakade ärenden) som skickas till **samtliga ~17 000 politiker i landet** via Cloudflare Email Service. Nyhetsbrevsprenumeranter (dubbel opt-in, Turnstile-skyddat, inget konto behövs) får exakt samma brev samma dag, med avregistreringslänk i varje utskick. Hela kedjan nyhetsbevakning → research → brev → utskick till politiker + prenumeranter är automatiserad

## Struktur

- `app/` — huvud-Worker: statisk frontend (`public/`, inkl. `i18n.js`, `components/` för wizard-stegen) + API (auth, mail-credentials, mottagarval, brev, AI-utkast, feedback, API-nycklar, admin)
- `app/src/send-queue.ts` — kö-konsumenten: faktisk SMTP-/Graph-sändning + `rate-limiter.ts` (Durable Object, token bucket per mailkoppling)
- `app/src/campaign/` — cron-körningarna: autonom kampanj som dagligen hämtar nyheter/riksdagsärenden, genererar medborgarbrev med Claude och skickar dem via Gmail
- `shared/` — kod som delas mellan Workern och Python-verktygen (kryptering, SMTP-klient, TOTP, Graph-mail, leverantörs-takter, typer)
- `infra/` — Cloudflare-provisionering (`cf-api.sh`, `az-graph-api.sh`, `schema.sql`) + `bounce-processor.py` (systemd-tjänst för Gmail-bouncehantering)

## Köra din egen kopia (ett kommando)

Hela stacken — Cloudflare-resurser, databas, hemligheter och app-Workern —
sätts upp av `infra/setup.sh`. Du behöver bara ett Cloudflare-konto och Node 18+.

```bash
git clone https://github.com/blixten85/politiker.git
cd politiker
bash infra/setup.sh
```

**Första körningen** skapar `~/.claude/credentials.env` (genererar `MAIL_CRED_KEY`
automatiskt) och avslutar så du kan fylla i dina värden. Minst:

- `SYSTEM_SMTP_PASSWORD` — SMTP-konto för verifierings-/notismail
- `CUSTOM_DOMAIN` — egen domän (lämna tom → deploy till `*.workers.dev`)
- Valfritt: `ANTHROPIC_API_KEY` + `GMAIL_EMAIL`/`GMAIL_PASSWORD` (autonom kampanj), `OAUTH_*_CLIENT_SECRET` (social inloggning)

**Andra körningen** gör resten automatiskt och idempotent:

1. `wrangler login` (öppnar webbläsare om du inte är inloggad)
2. Skapar D1, KV, Queue och R2 i ditt konto — och patchar `wrangler.jsonc` med dina resurs-ID:n
3. Applicerar `infra/schema.sql` (bara på en nyskapad databas — rör aldrig befintlig data)
4. Sätter secrets och deployar `app`
5. Installerar `bounce-processor` som systemd-timer (Linux + Gmail-creds)

Kör om `bash infra/setup.sh` när som helst för att uppdatera deployen.
SMTP-host/-user/-from och OAuth-client-ID:n bor i `wrangler.jsonc` → `vars`
om du vill ändra dem.

> Databasen skapas tom på politikerdata — importera den från
> [`kontakter/data/`](kontakter/data/), som publicerar hela kontaktdatabasen
> som färdig SQL:
>
> ```bash
> wrangler d1 execute politiker --remote --yes \
>   --file kontakter/data/politiker.sql
> ```

App-Workern, inklusive kampanjkörningarna, driftsätts även automatiskt vid
kodöverföring till `main` via Cloudflare Workers Builds.

### Lokal utveckling

```bash
cd app && npm install && cp .dev.vars.example .dev.vars  # fyll i riktiga värden
npm run dev
```

`MAIL_CRED_KEY` krypterar och dekrypterar användarnas SMTP-lösenord. Den låg
tidigare i två Workers och måste hållas identisk mellan dem; efter
sammanslagningen finns bara en.

### Felspårning

Fel loggas via `console.error`/`console.warn` och läses i Cloudflares
Workers-observability (aktiverad i respektive `wrangler.jsonc`) eller med
`wrangler tail`. Källkartor laddas upp vid deploy (`upload_source_maps`), så
stacktraces i Cloudflares dashboard pekar på riktig TS-kod istället för
bundlat JS.

Sentry användes tidigare men är avvecklat — se `git log` för borttagningen.

## Versioner

Beroenden och basimager hålls **flytande**, inte pinnade. En pinne som ingen
revideras sitter kvar långt efter att den blivit fel: scraperns basimage satt
på Ubuntu 22.04 långt efter att 24.04 fanns, eftersom OS-generationen låg i
taggnamnet (`v1.62.0-jammy`) och Dependabot aldrig byter taggfamilj.

Enda undantaget är GitHub Actions, som pinnas till commit-SHA. En tagg som
`@v4` kan pekas om till annan kod; en SHA kan den inte. Det är en
leverantörskedjekontroll, inte versionshantering.

Se `AGENTS.md` för regeln i sin helhet.

## Projektadministration

Förvaret förvaltas som ett personligt projekt. GitHubs Issues, Discussions,
Wiki och Projects används inte. Felrapporter och kontaktfrågor hanteras i
appens inbyggda formulär och administratörsvy.

## Sponsring

Stöd utvecklingen via [GitHub Sponsors – @blixten85](https://github.com/sponsors/blixten85),
[PayPal](https://www.paypal.com/paypalme/anders0225/25) eller
[WhyDonate](https://whydonate.com/sv/donate/politiker-kontakt).

## Status

Live på politiker.denied.se. Inloggning med e-post, Google, GitHub och
Microsoft är fullt konfigurerad och verifierad live, liksom
passwordlös mailkoppling via Microsoft Graph.

**Avsiktligt inte byggt** (väntar på donationsintäkter för att täcka kostnad):
- **Apple-inloggning** — kräver betalt Apple Developer-konto (99 USD/år) + JWT-signerad client secret.
- **Gmail-OAuth för mailsändning** — kräver Googles CASA-säkerhetsgranskning (några hundra till tusentals USD, återkommande årligen).

### Driftsövervakning

Ingen automatisk hälsokontroll. Den tidigare cron-Workern (`healthcheck/`,
05:00 UTC) togs bort: dess två Cloudflare-API-kontroller läste ett tomt
`result` som "resursen finns inte" och larmade om raderade Workers när
API-tokenen bara saknade behörighet, och Access-kontrollen utgick från en
policymodell som inte längre gäller för domänen.

### Kända Workers-specifika fallgropar

Hittade och fixade under utveckling/drift:
- PBKDF2 i Workers' WebCrypto stödjer max 100 000 iterationer (inte t.ex. 210 000).
- `socket.startTls()` kräver att writer/reader släpps med `.releaseLock()`
  innan anropet — `.close()` håller kvar låset och TLS-uppgraderingen kastar fel.
- Cloudflares scoped API-tokens stödjer inte `/accounts/{id}/workers/domains`
  (kräver Global API Key) — custom domain kopplas istället via
  `/accounts/{id}/workers/domains/records/{id}` (PUT, fungerar med scoped token)
  efter att posten finns, eller manuellt i dashboarden första gången.
- Kontot har Cloudflare Access (Zero Trust) med default-deny — en egen
  Access-app med "bypass"-policy (`everyone`) krävdes för att göra
  politiker.denied.se publik, utan att röra de andra apparnas privata policies.
- **`run_worker_first` krävs för `/api/*`-vägar** när `not_found_handling`
  är satt till `single-page-application` — annars kan Cloudflares
  static-asset-lager servera SPA-fallbacken direkt för API-anrop **utan att
  Workern körs alls**, vilket i kombination med Cloudflares "Speed Brain"
  (spekulativ förhämtning av länkar) orsakade att OAuth-inloggningsknappar
  tystnade och bara verkade ladda om sidan, fast i ett cache-lager som inte
  rensas av vanlig `purge_cache`.
