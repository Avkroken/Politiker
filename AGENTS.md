# politiker-webapp — AI Agent Guide

Gratis webbverktyg där medborgare skapar konto, kopplar sitt **eget**
mailkonto (Gmail/Outlook/iCloud/generisk SMTP), väljer kommuner/regioner/
riksdag/regering att kontakta, och skickar personaliserade brev till sina
folkvalda — utan att plattformen själv blir avsändare. Live på
politiker.denied.se.

Repot rymmer hela datakedjan: `kontakter/` skrapar fram kontaktuppgifterna
och skriver dem till D1, webappen serverar samma D1. De två låg tidigare i
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
cd ../sender && npm install

npx wrangler dev --remote   # i app/ eller sender/
npx tsc --noEmit            # typecheck
```

## Project Structure

```
app/          # Huvud-Worker: statisk frontend + API (auth, mail-credentials, mottagarval, brev, feedback)
sender/       # Queue consumer-Worker: faktisk SMTP-sändning
campaign/     # Worker för kampanjutskick
shared/       # Delad kod (kryptering, SMTP-klient, TOTP, typer)
healthcheck/  # Cron-Worker: daglig hälsokontroll (05:00 UTC), mailar status via Resend
infra/        # Cloudflare-provisionering (cf-api.sh, schema.sql)
kontakter/    # Python-skrapan som fyller D1:n, plus export-/verifieringsskript
forening/     # Föreningsdokument (stadgar, mötesmallar)
```

## Conventions

- `MAIL_CRED_KEY` (AES-nyckel för krypterade SMTP-lösenord) måste vara **identisk** i app och sender — sätts via `wrangler secret put`, aldrig hårdkodad
- Lösenord hashas med PBKDF2 via Web Crypto — **max 100 000 iterationer**, Workers' runtime tillåter inte mer
- `socket.startTls()` kräver `.releaseLock()` på writer/reader innan anropet, inte `.close()` — annars kastar uppgraderingen fel
- Aldrig logga eller exponera SMTP-lösenord, TOTP-secrets eller session-tokens
- Alla databasfrågor filtrerar på `account_id` — konton är helt isolerade från varandra utom via `/api/admin/*` (kräver `is_admin = 1`)

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

## Allowed
- Create branches
- Modify code
- Run tests
- Open PRs

## Forbidden
- Push directly to main/master
- Merge PRs på eget initiativ (be uttryckligen så är det okej)
- Delete branches
- Disable workflows
- Modify secrets
- Change GitHub org settings

## Requirements
- All tests must pass
- Keep PRs focused
- Never include unrelated changes
- Never commit credentials
- Never force push

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
