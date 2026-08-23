# politiker — AI Agent Guide

Gratis webbverktyg där medborgare skapar konto, kopplar sitt **eget**
mailkonto (Gmail/Outlook/iCloud/generisk SMTP), väljer kommuner/regioner/
riksdag/regering att kontakta, och skickar personaliserade brev till sina
folkvalda — utan att plattformen själv blir avsändare. Live på
politiker.denied.se.

Repot rymmer hela datakedjan: `kontakter/` skrapar fram kontaktuppgifterna
och skriver dem till D1, tjänsten serverar samma D1. De två låg tidigare i
var sitt repo trots att de delar databas. Djupare detaljer om skraparen står
i `kontakter/CLAUDE.md`.

## Tech Stack

- TypeScript, Cloudflare Workers (inget tungt frontend-ramverk — vanilla HTML/JS)
- Cloudflare D1 (SQLite), KV (sessioner), Queues (asynkron sändning)
- `cloudflare:sockets` för utgående SMTP — egenskriven minimal klient, ingen extern mail-dependency
- Wrangler för dev/deploy

## Dev Commands

```bash
cd app && npm install && cp .dev.vars.example .dev.vars  # fyll i riktiga värden

npx wrangler dev --remote   # i app/
npm test                    # snabba enhetstester
npx tsc --noEmit            # typecheck
```

## Project Structure

```
app/          # Hela Workern: fetch (frontend + API), queue (utskick), scheduled (kö/retention)
  src/send-queue.ts  # Kö-konsumenten: SMTP-/Graph-sändning av användarnas brev
  src/rate-limiter.ts # Durable Object, token bucket per mailkoppling
  src/letter-privacy.ts # Kryptering och retention för brevdata
shared/       # Delad kod (kryptering, SMTP-klient, validering, TOTP, typer)
infra/        # Cloudflare-provisionering (cf-api.sh, schema.sql)
kontakter/    # Python-skrapan som fyller D1:n, plus export-/verifieringsskript
forening/     # Föreningsdokument (stadgar, mötesmallar)
```

## Conventions

- **En Worker, tre handlers.** `politiker` bär `fetch`, `queue` och `scheduled`. `scheduled` fyller på användarinitierade flerdagarsutskick och kör dataminimering/retention. Tidigare autonoma kampanj- och publiceringsfunktioner är borttagna.
- **Kön tillåter en konsument.** `politiker-send-jobs` konsumeras av appen. Ett andra script som deklarerar samma konsument avvisas av Cloudflare.
- **Stora användarutskick är beständiga.** Alla deduplicerade mottagare sparas i `send_job_recipients`; bara den del som ryms inom kontots och mailkopplingens dygnskvot läggs på Cloudflare Queue. Schemakörningarna fyller på nästa del tills jobbet är klart.
- **Utskickstakten är data, inte kod.** `send_jobs` kan ha ett eget aktuellt dygnstak och ett schemalagt nästa tak. Värdena sätts vid skapandet eller ändras via utskickets API; hårdkoda aldrig tillfälliga antal eller datum.
- **Durable Object-klassen exporteras från `src/index.ts`** — Workers kräver att DO-klasser ligger i entrypointen.
- `MAIL_CRED_KEY` (AES-nyckel för krypterade SMTP-lösenord och brevdata) sätts via `wrangler secret put`, aldrig hårdkodad.
- Lösenord hashas med PBKDF2 via Web Crypto — **max 100 000 iterationer**, Workers' runtime tillåter inte mer.
- `socket.startTls()` kräver `.releaseLock()` på writer/reader innan anropet, inte `.close()` — annars kastar uppgraderingen fel.
- Aldrig logga eller exponera SMTP-lösenord, TOTP-secrets eller session-tokens.
- Alla databasfrågor filtrerar på `account_id` — konton är helt isolerade från varandra utom via `/api/admin/*` (kräver `is_admin = 1`).
- Klientfel och användarnas felrapporter sparas i D1 och skickas som e-postnotiser; GitHub Issues används inte för felrapportering.

## Versioner: flytande som standard

Pinna aldrig ett versionsnummer, en release-flavor eller en digest om det inte
är ett absolut måste. En pinne som ingen reviderar sitter kvar långt efter att
den blivit fel.

Gäller basimager, pip- och npm-beroenden, och allt annat med en version.

**Om en pinne ändå är nödvändig** ska den dokumenteras på plats, i den här
filen och i README — med vad som är pinnat, varför, och vad som måste
kontrolleras för att kunna släppa den igen. En odokumenterad pinne är en bugg
som väntar.

### Nuvarande undantag

- **GitHub Actions pinnas till commit-SHA.** En tagg som `@v4` är föränderlig
och kan pekas om till annan kod; en SHA kan den inte. Det är en
leverantörskedjekontroll, inte versionshantering, och Dependabot bumpar dem
automatiskt.

- **`kontakter/scraper/Dockerfile` pinnas till `v1.62.0-noble`.** `:latest`
pekar fortfarande på Ubuntu 22.04 hos Microsoft. Uppmätt 2026-08-17: 856
åtgärdbara CVE:er på `:latest` mot 39 på `v1.62.0-noble`. Dependabot bumpar
inom `-noble`-familjen men flyttar aldrig till nästa Ubuntu-generation. Kontrollera
om `:latest` hunnit ikapp till 24.04 eller senare, alternativt om en 26.04-variant
finns, innan pinnen släpps.

## Arbetsflöde: exakt en uppgift åt gången

Repositoryt har exakt två arbetsgrenar: `dev` och `main`. Skapa aldrig en tredje gren, inte ens tillfälligt. Allt utvecklingsarbete görs på `dev` och går via ett ändringsförslag från `dev` till `main`.

En agent får ha exakt en aktiv koduppgift åt gången. Flera uppgifter är en kö, inte parallellt arbete. Nästa uppgift får inte påbörjas förrän den aktuella uppgiften är mergad eller stängd.

### PR-lås: `dev` är fryst medan PR är öppen

En öppen `dev` → `main`-PR innebär ett absolut stopp för alla nya ändringar på `dev`. Från det ögonblick PR:n skapas tills den är mergad eller stängd ska agenten behandla `dev` som skrivskyddad.

Under en öppen PR är följande förbjudet utan undantag:

- nya commits eller pushar till `dev`, även för samma uppgift
- CI-fixar, review-fixar, dokumentationsändringar, cleanup eller "små sista ändringar"
- att börja nästa uppgift eller förbereda ändringar på `dev`
- att ändra PR-headen, force-pusha, rebase:a eller på annat sätt modifiera den öppna PR:n
- att smyga in orelaterade eller sena ändringar i en redan påbörjad PR

Om CI eller review visar att kod måste ändras ska den öppna PR:n **inte** fyllas på. Stäng PR:n, gör nödvändiga ändringar först när ingen `dev` → `main`-PR längre är öppen, testa om hela batchen och öppna därefter en ny PR.

För varje uppgift:

1. Kontrollera att ingen `dev` → `main`-PR är öppen och synka `dev` med `main`.
2. Implementera hela uppgiften, inklusive tester, dokumentation och rimliga följdjusteringar, innan något pushas.
3. Commit och push till `dev` en gång när uppgiften är redo för CI/granskning.
4. Skapa PR `dev` → `main` och aktivera auto-merge omedelbart. Med GitHub CLI: `gh pr create --base main --head dev --fill` följt direkt av `gh pr merge --auto`.
5. När PR:n är mergad eller stängd, synka `dev` med `main`. Först därefter får nästa ändring göras.

CI-väntan är aldrig ett skäl att börja eller pusha något annat. Om en ny idé, dokumentationsfix eller annan uppgift uppstår medan PR:n är öppen ska den bara noteras och vänta.

## Minsta behörighet och minsta komplexitet

Behörigheter är en begränsad resurs, inte en bekvämlighetsfunktion. En agent ska arbeta med minsta nödvändiga rättighet och får inte föreslå bredare access, admin eller root som standardlösning på ett problem.

Om en uppgift verkligen blockeras av behörighet ska agenten ange exakt vilken operation som nekades, vilken minsta specifika permission som krävs och varför. Begär inte generell admin/root när en smalare rättighet eller korrekt metod löser uppgiften.

Föredra den enklaste befintliga mekanismen som löser problemet. Skapa inte nya repos, tjänster, wrappers, daemons, specialflöden eller hjälpprogram för att kringgå en normal mekanism utan ett konkret, dokumenterat behov. Ny infrastruktur måste motiveras av ett verkligt problem, inte av abstrakt "best practice".

Om en lösning kräver flera nya komponenter för att undvika en direkt standardmetod ska agenten först ompröva angreppssättet.

## Tillåtet
- Ändra kod på `dev` endast när ingen `dev` → `main`-PR är öppen
- Köra lokala tester och analyser utan att ändra den öppna PR:n
- Öppna ändringsförslag endast från `dev` till `main`
- Rapportera blockerare och vänta tills aktuell PR är avslutad

## Förbjudet
- Skapa andra grenar än `dev` och `main`
- Commit eller push till `dev` medan en `dev` → `main`-PR är öppen
- Arbeta parallellt på flera koduppgifter eller smyga in sena ändringar
- Skicka ändringar direkt till `main` eller `master`
- Radera grenar, stänga av arbetsflöden eller kringgå branch protection/rulesets
- Ändra hemligheter eller organisationsinställningar utan uttrycklig instruktion
- Begära eller använda bredare admin/root-behörighet som bekvämlighetslösning

## Krav
- Överlämna kodändringar endast på `dev`
- Alla relevanta tester och tillhörande dokumentationsändringar ska vara klara före push/PR
- Håll varje ändringsförslag avgränsat till exakt en uppgift
- Ta aldrig med orelaterade ändringar eller överlämna hemligheter till versionshistoriken
- Skapa PR som klar för granskning, aldrig som utkast, och aktivera auto-merge omedelbart
- Ändra aldrig PR-headen efter att PR:n öppnats; stäng och ersätt PR:n om kod måste ändras
- Auto-merge får slutföras först när alla regelkrav och kontrollkörningar har godkänts
- Om auto-merge inte kan aktiveras: rapportera det exakta felet, men ändra inte `dev` medan PR:n är öppen
- Efter merge eller stängning: synka `dev` till `main` innan nästa uppgift

## Svarsformat

Regeluppsättningen kommer från plugin:et `i-have-adhd`. Den laddas inte i
alla sessioner (t.ex. inte i Claude Code på webben), så den står här —
det här är källan som gäller oavsett var agenten kör.

Form:

- Led med åtgärden eller kommandot, inte med bakgrunden
- Numrera flerstegsprocesser, ett avgränsat steg per rad
- Max fem punkter per lista
- Hoppa över inledningar, sammanfattningar och avslutningsfraser
- Långa förklaringar bara på begäran

Innehåll:

- Säg uttryckligen vad som är gjort och vad som återstår
- Ange konkreta tidsuppskattningar
- Visa vad som fungerar efter en ändring, inte bara att den är gjord
- Vid fel: var, varför och hur det åtgärdas — kortfattat
- Avsluta med ett nästa steg som tar under två minuter
