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
- Aktivera auto-merge först när live-rulesetet är verifierat fail-closed för den aktuella mergepolicyn.
- Använd inte direkt merge om det inte uttryckligen begärts.
- Live-rulesetet tillåter endast squash merge.
- Repositoryt använder inte merge queue och har ingen obligatorisk återanvändbar branchpool.
- Central säkerhetsremediation använder körningsunika branches under `automation/codex-issue/` endast när GitHubs inbyggda remediation inte kan hantera alerten.

## Merge-gates

För `main` gäller:

- required status check: `CI / required`
- required status check: `docker`
- required status check: `scan-pr / osv-scan`
- required status checks körs strikt mot aktuell `main`; en inaktuell PR-head får inte mergeas
- Code Scanning merge protection kräver färdig CodeQL-analys och blockerar nya CodeQL-säkerhetsfynd från medium och uppåt samt relevanta error/warning-fynd
- Code Scanning merge protection kräver färdig Trivy-analys och blockerar nya high/critical-fynd; lägre basimagefynd rapporteras men är inte mergeblockerande
- olösta review-trådar blockerar merge
- 0 mänskliga approvals krävs; review-enforcement sker via explicita CI-/security-gates och lösta review-trådar i stället för ett generellt approval-krav
- Copilot Code Review är rådgivande och ska ha `review_on_push` aktiverat så varje ny push kan granskas; Copilot är inte en mergegate
- squash är enda tillåtna merge-metod

CodeRabbit använder repositorykonfigurationen i `.coderabbit.yaml` med inheritance från organisationen. `review_progress` ska vara avstängt så den legacy statuscontext som används för observation publiceras deterministiskt; `commit_status` och `fail_commit_status` ska vara aktiva, incremental review ska köras efter varje push och automatisk paus ska vara avstängd. CodeRabbit är best effort och dess statuscontext är inte required i rulesetet: pending, failure, rate limit eller saknad status får därför inte ensamt blockera merge. Om CodeRabbit faktiskt lämnar review-kommentarer eller trådar ska de däremot läsas och utvärderas som annan review-feedback, och olösta trådar blockerar genom repositoryts generella thread-resolution-regel. I PR #372 observerades på en äldre HEAD `success` med beskrivningen `Review rate limited`; `fail_commit_status` ska därför vara aktiv så ett sådant läge rapporteras sanningsenligt som fel i stället för falskt success, utan att göra tjänstens tillgänglighet till ett mergekrav.

Alla review-kommentarer och trådar ska läsas och utvärderas. Relevanta findings åtgärdas i samma PR. En tråd markeras resolved först när eventuell nödvändig fix är pushad och verifierad.

Efter varje ny commit ska relevant CI, security och review-status kontrolleras igen. När samtliga required gates är godkända och alla relevanta review-trådar är resolved får auto-merge föra PR:n till `main`.

Om auto-merge inte sker ska den konkreta blockeraren i live-ruleset, security-state, review-state eller repositoryinställning identifieras. Kringgå aldrig repositoryskydd.

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

- `.github/workflows/ci.yml` producerar den stabila mergegaten `CI / required`; den sammanfattar `typecheck` och den impact-styrda Python-verifieringen.
- `typecheck` blockerar PR:er som fortfarande innehåller `.github/codex-dispatch/issue-*.md`; eftersom `CI / required` kräver `typecheck` får en remediation-seed aldrig nå `main`.
- `typecheck` ska validera appens tester, lokal D1-migrationskedja, Worker-typer, TypeScript och Wrangler dry-run samt ett separat dry-run av `log-archive`.
- `.github/workflows/osv-scanner.yml` producerar PR-gaten `scan-pr / osv-scan`; OSV:s PR-workflow ska misslyckas på nya sårbara beroenden.
- `.github/workflows/docker.yml` producerar terminalgaten `docker`. Den bygger relevant image och laddar upp Trivy-SARIF för aktuell HEAD, eller en explicit tom Trivy-analys när image inte berörs. `docker` ska vara required så image-/workflowfel inte kan döljas bakom utebliven SARIF; Trivy-fynd verkställs dessutom av Code Scanning-regeln.
- Security alerts hanteras centralt av organisationens Skvallerbyttan-flöde. GitHubs inbyggda Dependabot security updates och Copilot-agent används först när de kan hantera alerten; endast återstående fall går via Skvallerbyttans centrala Codex-fallback. Repositoryt ska inte ha en egen schemalagd Code Scanning-snapshot eller en egen security-remediation-writer.
- `.github/workflows/auto-fix-review.yml` får begära Codex-fix för uttryckligen betrodd review-feedback men får inte lösa review-tråden åt implementationen.

## Säkerhet

- Alla kontoägda databasfrågor ska filtrera på `account_id`; admin-endpoints kräver uttrycklig adminbehörighet.
- `MAIL_CRED_KEY`, SMTP-lösenord, OAuth-secrets, TOTP-secrets och sessionstokens är känsliga.
- PBKDF2 ska hålla sig inom Workers runtime-begränsningar; ändra inte säkerhetsparametrar utan verifiering.
- Föredra minsta nödvändiga behörighet och leverantörens standardmekanismer framför egna wrappers eller specialflöden.
- GitHub Actions ska pinnas till commit-SHA när praktiskt möjligt.

## Verifiering

Granska hela diffen mot `main` före PR. Kör eller verifiera relevant `CI / required`, `docker`, OSV, CodeQL, Trivy och CodeRabbit-status för aktuell HEAD efter varje push. Kontrollera att inga secrets, credentials, debugrester eller oavsiktliga genererade filer har lagts till.

När ändringen påverkar Cloudflare runtime, bindings, secrets, routes, queues, migrationer eller annan live-konfiguration ska den deployade konfigurationen verifieras efter merge. För appändringar innebär det normalt en grön `Workers Builds: politiker` på den mergade `main`-SHA:n där native migration, strict deploy och produktionsverifiering har passerat.

## Svarsformat

**[SKILLS.md](SKILLS.md) styr allt svarsformat. Läs den och följ den i varje svar.**

## Definition of done

En PR-baserad uppgift är klar först när implementationen är färdig, diffen självgranskad, all review-feedback utvärderad, samtliga required CI/security/review-gates gäller aktuell HEAD, relevanta review-trådar är resolved och PR:n har mergats av normal repositorypolicy eller är kvar därför att en verifierad extern gate väntar.

## PR-scope efter öppning

Den här sektionen förtydligar tidigare formuleringar om att relevanta findings ska åtgärdas i samma PR.

- När en PR har öppnats är dess avsedda scope, så som det beskrivs i PR:n, fryst. Fortsatta commits får endast slutföra eller korrigera det scopet.
- Om CI, Code Scanning, tester eller review hittar ett fel som orsakas av PR:ns befintliga ändringar ska just det felet rättas på samma branch/PR. Det är en korrigering inom scope, inte ny scope.
- Ny funktionalitet, opportunistiska refactors, städning eller separata förbättringar som upptäcks efter att PR:n öppnats ska få en ny kortlivad branch och en ny PR från aktuell `main`; återanvänd inte den öppna PR-grenen för nästa uppgift.
- Försök inte hinna lägga commits före eller under en pågående CI-/reviewkörning av tidsskäl. Gör en komplett ändring, pusha den, låt gates utvärdera den HEAD:en och reagera därefter.
- Efter varje korrigerande commit ska relevanta tester köras om och hela tillämpliga gate- och review-state verifieras på den nya HEAD:en före merge.
