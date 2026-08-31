# AGENTS.md

Den här filen är repositoryts auktoritativa arbetsinstruktion. Live GitHub-konfiguration är verkställande sanning när dokumentation och faktisk enforcement skiljer sig.

## Repository

`politiker` är en webbtjänst där användare kopplar sitt eget mailkonto och skickar personaliserade brev till folkvalda.

- `app/` — Cloudflare Worker med `fetch`, `queue` och `scheduled`.
- `log-archive/` — Tail Worker som arkiverar `app/`:s loggevent till R2.
- `shared/` — delad validering, kryptering, SMTP, Graph och typer.
- `infra/migrations/` — Wranglers native D1-migrationer.
- `kontakter/` — separat Python-insamling, normalisering och verifiering av kontaktdata.
- D1, KV, Queues, R2 och Durable Objects används i produktion.

Cloudflare D1 är kanonisk runtime-datakälla. Git får inte användas som produktionsdatabas, D1-snapshot eller alternativ Cloudflare-kontrollplan.

## Brancher och pull requests

- Pusha aldrig direkt till `main`.
- Använd en kortlivad branch och öppna en ready PR till `main`.
- Aktivera auto-merge omedelbart när PR:n skapats, även medan CI eller review pågår.
- Använd inte direkt merge om det inte uttryckligen begärts.
- Live-rulesetet tillåter endast squash merge.
- Repositoryt använder inte merge queue och har ingen obligatorisk återanvändbar branchpool.
- Codex-remediation använder körningsunika branches under `automation/codex-issue/`.

## Merge-gates

För `main` gäller:

- required status check: `typecheck`
- required status check: `python`
- olösta review-trådar blockerar merge
- 0 approvals krävs
- Copilot Code Review är aktiverad; live-rulesetet har `review_on_push` avstängt
- squash är enda tillåtna merge-metod

Alla review-kommentarer och trådar ska läsas och utvärderas. Relevanta findings åtgärdas i samma PR. En tråd markeras resolved först när eventuell nödvändig fix är pushad och verifierad.

Efter varje ny commit ska relevant CI och review-status kontrolleras igen. När required checks är gröna och alla relevanta review-trådar är resolved ska den redan armerade auto-merge-funktionen föra PR:n till `main`.

Om auto-merge inte sker ska den konkreta blockeraren i live-ruleset, review-state eller repositoryinställning identifieras. Kringgå aldrig repositoryskydd.

## Cloudflare-kontrollplan

- `app/wrangler.jsonc` är source of truth för versionshanterad Worker-konfiguration: bindings, routes, queues, cron, assets, Durable Objects, Tail Worker, publika variabler och required secret names.
- Secret-värden ligger i Cloudflare och får aldrig hårdkodas eller dupliceras i GitHub Actions.
- Cloudflare Workers Builds äger normal produktionsdeploy från `main`; GitHub Actions ska inte deploya produktion.
- `politiker` ska ha root directory `app` och deploy command `npm run migrate:production && npm run deploy && npm run verify:production`.
- `politiker-log-archive` ska ha root directory `log-archive` och deploy command `npm run deploy`.
- Appens `deploy` är direkt `wrangler deploy --strict --outdir dist`; `log-archive` använder direkt `wrangler deploy --strict`.
- Skapa inte repo-lokala deploywrappers, branch/SHA-guards eller resursprovisionerare som duplicerar Workers Builds/Wrangler.
- App-Workern är ensam D1-migrationsägare. Alla schemaändringar ska använda Wranglers native D1 migrations under `infra/migrations/` och state-tabellen `d1_migrations`.
- Skapa aldrig en parallell schemafil, egen migrationsmotor eller GitHub Action som muterar produktions-D1.
- `scripts/verify-production.mjs` verifierar endast appens publika HTTP-status efter deploy. `log-archive` är endast tail-konsument och ska inte exponeras publikt för health-check.
- Workers Builds watch paths ska vara `app/**`, `shared/**`, `infra/migrations/**` och `scripts/verify-production.mjs` för appen; `log-archive/**` för tail-konsumenten.

## Kontaktdata

- `kontakter/` är en dataproducent, inte en Cloudflare-kontrollplan.
- Scraper/importjobb får endast mutera kontaktdata med minsta nödvändiga D1-behörighet.
- De får inte provisionera resurser, deploya Workers, köra schemaändringar eller exportera live-D1 tillbaka till Git.
- Leveransfel från användarens egna mailkopplingar hanteras av Worker/kökonsumenten; återinför inte central systemd/Gmail-bouncehantering.

## GitHub Actions

- `.github/workflows/ci.yml` producerar required contexts `typecheck` och `python`.
- Required `typecheck` blockerar PR:er som fortfarande innehåller `.github/codex-dispatch/issue-*.md`; en remediation-seed får aldrig nå `main`.
- `typecheck` ska validera appens tester, lokal D1-migrationskedja, Worker-typer, TypeScript och Wrangler dry-run samt ett separat dry-run av `log-archive`.
- `.github/workflows/osv-scanner.yml` och `.github/workflows/docker.yml` är kompletterande säkerhetsverifiering.
- `.github/workflows/codex-issue-remediation.yml` skapar en körningsunik remediation-branch, öppnar PR och armerar auto-merge.
- `.github/workflows/auto-fix-review.yml` får begära Codex-fix för uttryckligen betrodd review-feedback men får inte lösa review-tråden åt implementationen.

## Säkerhet

- Alla kontoägda databasfrågor ska filtrera på `account_id`; admin-endpoints kräver uttrycklig adminbehörighet.
- `MAIL_CRED_KEY`, SMTP-lösenord, OAuth-secrets, TOTP-secrets och sessionstokens är känsliga.
- PBKDF2 ska hålla sig inom Workers runtime-begränsningar; ändra inte säkerhetsparametrar utan verifiering.
- Föredra minsta nödvändiga behörighet och leverantörens standardmekanismer framför egna wrappers eller specialflöden.
- GitHub Actions ska pinnas till commit-SHA när praktiskt möjligt.

## Verifiering

Granska hela diffen mot `main` före PR. Kör eller verifiera relevanta tester, typecheck, Python-CI och säkerhetsjobb efter varje push. Kontrollera att inga secrets, credentials, debugrester eller oavsiktliga genererade filer har lagts till.

När ändringen påverkar Cloudflare runtime, bindings, secrets, routes, queues, migrationer eller annan live-konfiguration ska den deployade konfigurationen verifieras efter merge. För appändringar innebär det normalt en grön `Workers Builds: politiker` på den mergade `main`-SHA:n där native migration, strict deploy och produktionsverifiering har passerat.

## Svarsformat

**[SKILLS.md](SKILLS.md) styr allt svarsformat. Läs den och följ den i varje svar.**

## Definition of done

En PR-baserad uppgift är klar först när implementationen är färdig, diffen självgranskad, all review-feedback utvärderad, required `typecheck` och `python` är gröna, relevanta review-trådar är resolved och auto-merge har mergat PR:n eller är armerad medan en verifierad extern gate fortfarande väntar.
