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
npx tsc --noEmit            # typecheck
```

## Project Structure

```
app/          # Hela Workern: fetch (frontend + API), queue (utskick), scheduled (kampanj)
  src/campaign/   # Cron-körningarna: nyhetsbevakning, brevgenerering, utskick, kvartalsbrev
  src/send-queue.ts  # Kö-konsumenten: SMTP-/Graph-sändning av användarnas brev
  src/rate-limiter.ts # Durable Object, token bucket per mailkoppling
shared/       # Delad kod (kryptering, SMTP-klient, TOTP, typer)
infra/        # Cloudflare-provisionering (cf-api.sh, schema.sql)
kontakter/    # Python-skrapan som fyller D1:n, plus export-/verifieringsskript
forening/     # Föreningsdokument (stadgar, mötesmallar)
```

## Conventions

- **En Worker, tre handlers.** `politiker` bär `fetch`, `queue` och `scheduled`. Tidigare var det fyra Workers (app, sender, campaign, healthcheck); de slogs ihop för att bindings, secrets och deploypipeline hölls synkade för hand mellan dem. Healthchecken togs bort helt.
- **Kön tillåter en konsument.** `politiker-send-jobs` konsumeras av appen. Ett andra script som deklarerar samma konsument avvisas av Cloudflare.
- **Stora användarutskick är beständiga.** Alla deduplicerade mottagare sparas i `send_job_recipients`; bara den del som ryms inom kontots och mailkopplingens dygnskvot läggs på Cloudflare Queue. Schemakörningarna fyller på nästa del tills jobbet är klart.
- **Utskickstakten är data, inte kod.** `send_jobs` kan ha ett eget aktuellt dygnstak och ett schemalagt nästa tak. Värdena sätts vid skapandet eller ändras via utskickets API; hårdkoda aldrig kampanjspecifika antal eller datum.
- **Durable Object-klassen exporteras från `src/index.ts`** — Workers kräver att DO-klasser ligger i entrypointen.
- `MAIL_CRED_KEY` (AES-nyckel för krypterade SMTP-lösenord) sätts via `wrangler secret put`, aldrig hårdkodad — appen både krypterar och dekrypterar sedan sammanslagningen
- Lösenord hashas med PBKDF2 via Web Crypto — **max 100 000 iterationer**, Workers' runtime tillåter inte mer
- `socket.startTls()` kräver `.releaseLock()` på writer/reader innan anropet, inte `.close()` — annars kastar uppgraderingen fel
- Aldrig logga eller exponera SMTP-lösenord, TOTP-secrets eller session-tokens
- Alla databasfrågor filtrerar på `account_id` — konton är helt isolerade från varandra utom via `/api/admin/*` (kräver `is_admin = 1`)
- Klientfel och användarnas felrapporter sparas i D1 och skickas som e-postnotiser; GitHub Issues används inte för felrapportering

## Versioner: flytande som standard

Pinna aldrig ett versionsnummer, en release-flavor eller en digest om det inte
är ett absolut måste. En pinne som ingen revideras sitter kvar långt efter att
den blivit fel — basimagen här satt på Ubuntu 22.04 långt efter att 24.04 fanns,
just för att OS-generationen låg inbakad i taggnamnet och Dependabot aldrig
rör sig mellan taggfamiljer.

Gäller basimager, pip- och npm-beroenden, och allt annat med en version.

**Om en pinne ändå är nödvändig** ska den dokumenteras på plats, i den här
filen och i README — med vad som är pinnat, varför, och vad som måste
kontrolleras för att kunna släppa den igen. En odokumenterad pinne är en bugg
som väntar.

### Nuvarande undantag

- **GitHub Actions pinnas till commit-SHA.** En tagg som `@v4` är föränderlig
  och kan pekas om till annan kod; en SHA kan den inte. Det är en
  leverantörskedjekontroll, inte versionshantering, och Dependabot bumpar dem
  ändå automatiskt.

- **`kontakter/scraper/Dockerfile` pinnas till `v1.62.0-noble`.** Regeln säger
  flytande, och det var också vad som stod här — men `:latest` pekar
  fortfarande på Ubuntu 22.04 hos Microsoft. Uppmätt 2026-08-17: 856
  åtgärdbara CVE:er på `:latest` mot 39 på `v1.62.0-noble`, alltså 96 procent
  av code scanning-bruset i det här repot. Dependabot bumpar inom
  `-noble`-familjen, men flyttar aldrig till nästa Ubuntu-generation — så
  **det som måste kontrolleras för att släppa pinnen** är om `:latest` hunnit
  ikapp till 24.04 eller senare, alternativt om det dykt upp en
  26.04-variant som suffixet behöver bytas till.

## Arbetsflöde: exakt en uppgift åt gången

Repositoryt har exakt två arbetsgrenar: `dev` och `main`. Skapa aldrig en tredje gren, inte ens tillfälligt. Allt utvecklingsarbete görs på `dev` och går via ett ändringsförslag från `dev` till `main`.

En agent får ha exakt en aktiv koduppgift åt gången. Flera uppgifter är en kö, inte parallellt arbete. Nästa uppgift får inte påbörjas förrän den aktuella uppgiften är mergad eller uttryckligen blockerad av något agenten inte kan lösa själv.

Arbeta lokalt så långt det är praktiskt innan du pushar. Samla sammanhängande ändringar, testfixar och följdjusteringar i meningsfulla batcher i stället för att pusha varje liten edit och därmed starta om CI i onödan. När en PR redan kör CI får du fortsätta analysera, testa och förbättra samma uppgift lokalt. Push endast när du har en ny sammanhängande batch som faktiskt behöver valideras. CI-väntan är aldrig ett skäl att börja på nästa uppgift.

För varje uppgift:

1. Synka `dev` med `main`. Om `dev` redan innehåller ofärdigt arbete, slutför det först.
2. Implementera och testa den aktuella uppgiften lokalt på `dev`; samla ändringar i så stora sammanhängande batcher som är rimliga.
3. Commit och push till `dev`, skapa eller uppdatera exakt ett PR `dev` → `main`, och aktivera auto-merge.
4. Medan CI/review pågår: fortsätt endast lokalt med samma uppgift. Lös relevanta fel och kommentarer och pusha dem samlat, inte en i taget. Efter varje push som ändrar PR-headen, och särskilt efter den sista pushen, verifiera uttryckligen att auto-merge fortfarande är aktiverad; återaktivera den om head-ändringen slog av den.
5. När PR:n är mergad, synka `dev` till `main`. Först därefter får nästa uppgift börja.

Om uppgiften blockeras av en extern åtgärd som agenten faktiskt inte kan utföra, dokumentera den exakta blockeraren och stanna. Börja inte en annan koduppgift utan uttrycklig instruktion från användaren.

## Tillåtet
- Ändra kod på `dev`
- Köra lokala tester och analyser
- Öppna ändringsförslag endast från `dev` till `main`
- Rätta CI- och reviewproblem för den aktiva uppgiften tills PR:n kan mergas

## Förbjudet
- Skapa andra grenar än `dev` och `main`
- Arbeta parallellt på flera koduppgifter
- Börja nästa uppgift medan den aktuella PR:n fortfarande är öppen eller blockerad
- Skicka ändringar direkt till `main` eller `master`
- Radera grenar
- Stänga av arbetsflöden
- Ändra hemligheter
- Ändra inställningar för GitHub-organisationen
- Tvinga igenom en push eller kringgå branch protection/rulesets

## Krav
- Överlämna kodändringar endast på `dev`
- Alla relevanta tester måste godkännas
- Håll varje ändringsförslag avgränsat till en uppgift
- Arbeta lokalt så mycket som möjligt och undvik onödigt täta pushar som startar om CI
- Ta aldrig med orelaterade ändringar
- Överlämna aldrig inloggningsuppgifter eller andra hemligheter till versionshistoriken
- Skapa ändringsförslag som klara för granskning, aldrig som utkast
- Aktivera automatisk sammanfogning med en metod som tillåts av förrådets regler direkt efter att ändringsförslaget skapats
- Efter varje push som ändrar PR-headen: verifiera att automatisk sammanfogning fortfarande är aktiv och återaktivera den vid behov
- Automatisk sammanfogning får slutföras först när alla regelkrav och kontrollkörningar har godkänts
- Om CI, review eller auto-merge blockerar leveransen: lös blockeraren för den aktiva uppgiften innan annat kodarbete påbörjas
- Om automatisk sammanfogning inte kan aktiveras: rapportera det exakta felet
- Efter merge: synka `dev` till `main` innan nästa uppgift

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
