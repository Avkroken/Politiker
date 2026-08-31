# CI, deploy och release

## Branchflöde

`main` tar bara emot ändringar via pull request. Arbete görs på kortlivade branches; repositoryt använder inte merge queue.

Öppna en ready PR mot `main`. Auto-merge får armeras först när live-rulesetet är verifierat fail-closed för policyn nedan. Direkt merge används bara när det uttryckligen begärts.

Före merge ska live-rulesetet kräva:

- `CI / required` från GitHub Actions.
- `docker` från Docker/Trivy-workflowens terminaljobb.
- `scan-pr / osv-scan` från OSV:s PR-workflow.
- strict required status checks, så PR-head måste vara uppdaterad med aktuell `main`.
- Code Scanning merge protection för CodeQL och Trivy.
- lösta review-trådar och squash merge.

Generella mänskliga approvals är inte required. CodeRabbit och Copilot Code Review är best-effort/rådgivande review-signaler och är inte required status checks. Copilot ska ha `review_on_push` aktiverat så en ny push inte återanvänder en gammal review. Om någon av tjänsterna faktiskt lämnar review-trådar måste relevanta findings hanteras och trådarna lösas före merge.

## Selektiv CI

- `app/**` och Node/TypeScript-konfiguration påverkar appens TypeScript-CI.
- `kontakter/**` och Python-konfiguration påverkar Python-CI.
- Gemensam CI-/dependency-konfiguration eller okänd påverkan kör båda.
- Dokumentation och processmetadata behöver normalt inte starta dyra språkjobb.

Required checks filtreras inte bort på workflow-nivå med `paths:`. Ett impact-jobb klassificerar diffen och efterföljande jobb använder job-level `if:`. Routing är fail-closed i praktiken: om påverkan inte kan avgöras säkert körs mer CI.

`CI / required` är den stabila CI-gaten. Den blir endast grön när `typecheck` är grön och Python-verifieringen antingen är grön eller uttryckligen klassificerad som ej tillämplig. GitHubs generella beteende där `skipped` kan räknas som godkänt exponeras därför inte direkt som mergepolicy.

`typecheck` kör appens tester, native D1-migrationer mot lokal D1, TypeScript typecheck, Wrangler dry-run, produktionsverifierarens Node-test och separat Wrangler dry-run av `log-archive`. GitHub Actions innehåller ingen produktionsdeploykedja.

`docker` är Docker/Trivy-workflowens stabila terminalgate. Den kör alltid på PR och blir failure/cancelled om underliggande image-/Trivy-flöde misslyckas. När ingen relevant image påverkas går workflowen genom en explicit not-applicable-väg i stället för att required-gaten försvinner.

## Review-enforcement

`.coderabbit.yaml` är repoets versionshanterade tillägg till organisationens CodeRabbit-konfiguration och använder `inheritance: true`.

- `review_progress: false` väljer den legacy commit-status som används som observerbar review-signal.
- `commit_status: true` publicerar statuscontexten `CodeRabbit` för committen som granskas när `review_progress` är avstängt.
- `fail_commit_status: true` gör att en review som inte kan slutföras rapporteras som failure i stället för ett missvisande success.
- `auto_incremental_review: true` gör att varje ny push granskas igen när CodeRabbit kan leverera review.
- `auto_pause_after_reviewed_commits: 0` förhindrar att CodeRabbit självt pausar incremental reviews efter ett antal commits.

På en äldre HEAD i PR #372 observerades `CodeRabbit = success` med beskrivningen `Review rate limited` innan den fail-closed-statusrapporteringen var etablerad. `fail_commit_status` behålls därför för att statusen ska vara sanningsenlig, men CodeRabbits tillgänglighet är inte ett mergekrav.

Rulesetet ska inte kräva statuscontexten `CodeRabbit`. Saknad, pending, failure eller rate limit i CodeRabbit-statusen får inte ensamt blockera merge. Om CodeRabbit faktiskt lämnar review-kommentarer eller review-trådar ska de däremot läsas och utvärderas; relevanta findings ska åtgärdas och repositoryts generella krav på lösta review-trådar gäller innan merge. CodeRabbit-status för aktuell HEAD används som observationssignal, inte som mergebevis.

Copilot Code Review är separat från CodeRabbit. `review_on_push` ska vara aktiverat, men Copilot är inte en hard gate eftersom tjänsten kan vara otillgänglig på grund av quota/policy och dess review inte lämnar ett GitHub approval-beslut.

## Säkerhetsgates

OSV:s PR-workflow jämför målbranch och PR-head och ska misslyckas när PR:n introducerar nya sårbara beroenden. `scan-pr / osv-scan` är därför required.

Docker/Trivy-workflowen bygger relevant scraper-image. När imagen inte påverkas laddas en explicit tom Trivy-SARIF upp för aktuell HEAD; när den påverkas laddas den faktiska Trivy-analysen upp. `docker` är required för själva image-/workflowresultatet. Trivy-processen har avsiktligt exit code 0 eftersom låga och medelhöga basimagefynd ska rapporteras utan att stoppa all utveckling; Code Scanning merge protection ska i stället kräva Trivy-resultatet och blockera nya high/critical-säkerhetsfynd.

CodeQL körs genom GitHubs Code Scanning default setup. Merge protection ska kräva en färdig CodeQL-analys och blockera nya säkerhetsfynd från medium och uppåt samt relevanta error/warning-fynd. GitHub Code Quality är inte en mergegate i detta repository eftersom ingen separat `CodeQL - Code Quality`-check har verifierats på aktuell PR-HEAD; en sådan gate får inte läggas till förrän analysen faktiskt är aktiverad och observerad stabilt.

## Cloudflare-owned production deploy

Cloudflare Workers Builds äger normal produktionsdeploy från `main`; GitHub Actions validerar men deployar inte produktion. Båda produktions-Workers ska ha production branch `main`, tomt build command och avstängda non-production branch builds.

| Worker | Root directory | Deploy command |
| --- | --- | --- |
| `politiker` | `app` | `npm run migrate:production && npm run deploy && npm run verify:production` |
| `politiker-log-archive` | `log-archive` | `npm run deploy` |

Appens `deploy` är direkt `wrangler deploy --strict --outdir dist`; `log-archive` använder direkt `wrangler deploy --strict`. Production branch, root directory, watch paths och kommandosekvens ägs av Cloudflare Workers Builds.

Appen är ensam migrationsägare för D1 `politiker-eu`. `npm run migrate:production` kör direkt `wrangler d1 migrations apply politiker-eu --remote`. `infra/migrations/` är den enda migrationskedjan och Wrangler-tabellen `d1_migrations` är den enda migrationsstate som används. Skapa inte en parallell migrationsmotor, schema-snapshot eller state-tabell.

Efter app-deploy kör `npm run verify:production`, som endast verifierar att `https://politiker.denied.se/` svarar HTTP 200. `log-archive` är endast tail-konsument och ska inte få en konstgjord publik health-route.

Workers Builds watch paths ska vara:

- `politiker`: `app/**`, `shared/**`, `infra/migrations/**`, `scripts/verify-production.mjs`
- `politiker-log-archive`: `log-archive/**`

`wrangler.jsonc` är source of truth för Worker-bindings, routes, queues, cron, tail consumers, required secret names och övrig versionshanterad Worker-konfiguration. Secrets ligger utanför repositoryt.

## Release

`.github/workflows/release.yml` bestämmer nästa SemVer-version från commitmeddelanden sedan senaste `vX.Y.Z`-taggen: breaking/`major:` ger major, `feat:`/`minor:` ger minor och `fix:`/`perf:`/`patch:` ger patch. Övriga commits skapar ingen release om ingen release-utlösande commit finns.
