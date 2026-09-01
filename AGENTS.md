# AGENTS.md

Den här filen är repositoryts auktoritativa arbetsinstruktion. Live GitHub-konfiguration är verkställande sanning när dokumentation och faktisk enforcement skiljer sig.

## Repository

`politiker` är en webbtjänst där användare kopplar sitt eget mailkonto och skickar personaliserade brev till folkvalda.

- `app/` — Cloudflare Worker med `fetch`, `queue` och `scheduled`.
- `log-archive/` — Tail Worker som arkiverar `app/`:s loggevent till R2.
- `shared/` — delad validering, kryptering, SMTP, Graph och typer.
- `infra/migrations/` — Wranglers native D1-migrationer.
- `kontakter/` — separat Python-insamling, normalisering och verifiering av kontaktdata.

Cloudflare D1 är kanonisk runtime-datakälla. Git får inte användas som produktionsdatabas, D1-snapshot eller alternativ Cloudflare-kontrollplan.

## Brancher och pull requests

- Pusha aldrig direkt till `main`.
- Använd en kortlivad branch och öppna en ready PR till `main`.
- Aktivera auto-merge först när live-rulesetet är verifierat fail-closed för den aktuella mergepolicyn.
- Använd inte direkt merge om det inte uttryckligen begärts.
- Endast squash merge är tillåtet.

## Merge-gates

Live-konfigurationen är sanningskällan. För `main` gäller bland annat:

- required `CI / required`, `docker` och `scan-pr / osv-scan`
- strict latest-base-verifiering
- en approval krävs; stale reviews avvisas efter push och den senaste pushen måste godkännas av någon annan
- olösta review-trådar blockerar merge
- CodeQL merge protection enligt org-rulesetet
- Trivy Code Scanning blockerar high/critical enligt org-rulesetet
- Copilot och CodeRabbit är rådgivande, men faktiska relevanta findings ska utvärderas och åtgärdas
- inga bypass actors

Efter varje ny commit ska relevant CI, security och review-status kontrolleras igen. Kringgå aldrig repositoryskydd.

## Cloudflare-kontrollplan

- `app/wrangler.jsonc` är source of truth för versionshanterad Worker-konfiguration.
- Secret-värden ligger i Cloudflare och får aldrig hårdkodas eller dupliceras i GitHub Actions.
- Cloudflare Workers Builds äger normal produktionsdeploy från `main`; GitHub Actions ska inte deploya produktion.
- `politiker` använder root `app` och deploy command `npm run migrate:production && npm run deploy && npm run verify:production`.
- `politiker-log-archive` använder root `log-archive` och deploy command `npm run deploy`.
- App-Workern är ensam D1-migrationsägare. Schemaändringar ska använda Wranglers native D1 migrations under `infra/migrations/`.
- Skapa inte parallella migrationsmotorer, deploywrappers eller GitHub Actions som muterar produktions-D1.

## Kontaktdata

- `kontakter/` är en dataproducent, inte en Cloudflare-kontrollplan.
- Scraper/importjobb får endast mutera kontaktdata med minsta nödvändiga D1-behörighet.
- De får inte provisionera resurser, deploya Workers, köra schemaändringar eller exportera live-D1 tillbaka till Git.

## GitHub Actions

- `.github/workflows/ci.yml` producerar `CI / required` och verifierar app/log-archive samt Pythonverktygen under `kontakter/`.
- `.github/workflows/docker.yml` producerar `docker`, bygger `kontakter/scraper` och laddar upp Trivy-SARIF.
- `.github/workflows/osv-scanner.yml` är repositoryts egen OSV-definition och producerar `scan-pr / osv-scan`.
- `.github/workflows/release.yml` skapar GitHub Releases från `main`; den är separat från PR-CI.
- Repositoryts workflows får inte skapa eller uppdatera pull requests eller branches, arma eller genomföra merge, automatisera review, delegera arbete till AI-agenter eller lagra säkerhetsalert-snapshots.
- Security alerts hanteras av GitHubs native säkerhetsfunktioner. Kodändringar går genom repositoryts vanliga PR-gates.
- GitHub Actions ska pinnas till full commit-SHA.

## Säkerhet

- Alla kontoägda databasfrågor ska filtrera på `account_id`; admin-endpoints kräver uttrycklig adminbehörighet.
- `MAIL_CRED_KEY`, SMTP-lösenord, OAuth-secrets, TOTP-secrets och sessionstokens är känsliga.
- Föredra minsta nödvändiga behörighet och leverantörens standardmekanismer framför egna wrappers.

## Verifiering

Granska hela diffen mot `main` före PR. Kör relevanta tester och verifiera required CI/security samt review-state för aktuell HEAD efter varje push. Kontrollera att inga secrets, credentials, debugrester eller oavsiktliga genererade filer lagts till.

## Svarsformat

**[SKILLS.md](SKILLS.md) styr allt svarsformat. Läs den och följ den i varje svar.**

## Definition of done

En PR-baserad uppgift är klar först när implementationen är färdig, diffen självgranskad, all review-feedback utvärderad, samtliga required CI/security/review-gates gäller aktuell HEAD, relevanta review-trådar är resolved och PR:n har mergats av normal repositorypolicy eller är kvar därför att en verifierad extern gate väntar.

## PR-scope efter öppning

- När en PR har öppnats är dess avsedda scope fryst. Fortsatta commits får endast slutföra eller korrigera det scopet.
- Fel som orsakas av PR:ns befintliga ändringar ska rättas i samma PR.
- Ny funktionalitet, opportunistiska refactors eller separata förbättringar ska få en ny branch och PR från aktuell `main`.
- Efter varje korrigerande commit ska relevanta tester samt gate- och review-state verifieras på den nya HEAD:en.
