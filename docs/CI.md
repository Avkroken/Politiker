# CI, deploy och release

## Branchflöde

`main` tar bara emot ändringar via pull request. Arbete görs på kortlivade branches; repositoryt använder inte merge queue.

Öppna en ready PR mot `main`. Auto-merge får armeras direkt först när live-rulesetet är verifierat fail-closed för policyn nedan. Direkt merge används bara när det uttryckligen begärts.

Före merge ska live-rulesetet kräva:

- `CI / required` från GitHub Actions.
- `scan-pr / osv-scan` från OSV:s PR-workflow.
- commit-statusen `CodeRabbit` från CodeRabbit för aktuell PR-HEAD.
- strict required status checks, så PR-head måste vara uppdaterad med aktuell `main`.
- Code Scanning merge protection för CodeQL och Trivy.
- GitHub Code Quality på warning-nivå och uppåt.
- lösta review-trådar och squash merge.

Generella mänskliga approvals är inte required. CodeRabbit är en explicit statusgate och Copilot Code Review är rådgivande. Copilot ska ha `review_on_push` aktiverat så en ny push inte återanvänder en gammal review.

## Selektiv CI

- `app/**` och Node/TypeScript-konfiguration påverkar appens TypeScript-CI.
- `kontakter/**` och Python-konfiguration påverkar Python-CI.
- Gemensam CI-/dependency-konfiguration eller okänd påverkan kör båda.
- Dokumentation och processmetadata behöver normalt inte starta dyra språkjobb.

Required checks filtreras inte bort på workflow-nivå med `paths:`. Ett impact-jobb klassificerar diffen och efterföljande jobb använder job-level `if:`. Routing är fail-closed i praktiken: om påverkan inte kan avgöras säkert körs mer CI.

`CI / required` är den stabila CI-gaten. Den blir endast grön när `typecheck` är grön och Python-verifieringen antingen är grön eller uttryckligen klassificerad som ej tillämplig. GitHubs generella beteende där `skipped` kan räknas som godkänt exponeras därför inte direkt som mergepolicy.

`typecheck` kör appens tester, native D1-migrationer mot lokal D1, TypeScript typecheck, Wrangler dry-run, produktionsverifierarens Node-test och separat Wrangler dry-run av `log-archive`. GitHub Actions innehåller ingen produktionsdeploykedja.

## Review-enforcement

`.coderabbit.yaml` är repoets versionshanterade tillägg till organisationens CodeRabbit-konfiguration och använder `inheritance: true`.

- `commit_status: true` ger statusen `CodeRabbit`: `pending` under review och `success` först när reviewn är klar.
- `fail_commit_status: true` gör att reviewfel inte kan maskeras som godkänt.
- `auto_incremental_review: true` gör att varje ny push granskas igen.

Rulesetet ska kräva `CodeRabbit` från CodeRabbit. Saknad, pending eller failure blockerar merge. Detta är mergegaten; en walkthrough-kommentar eller text som säger att review pågår är inte ett godkännande.

Copilot Code Review är separat från CodeRabbit. `review_on_push` ska vara aktiverat, men Copilot är inte en hard gate eftersom tjänsten kan vara otillgänglig på grund av quota/policy och dess review inte lämnar ett GitHub approval-beslut.

## Säkerhetsgates

OSV:s PR-workflow jämför målbranch och PR-head och ska misslyckas när PR:n introducerar nya sårbara beroenden. `scan-pr / osv-scan` är därför required.

Docker/Trivy-workflowen bygger relevant scraper-image. När imagen inte påverkas laddas en explicit tom Trivy-SARIF upp för aktuell HEAD; när den påverkas laddas den faktiska Trivy-analysen upp. Trivy-processen har avsiktligt exit code 0 eftersom låga och medelhöga basimagefynd ska rapporteras utan att stoppa all utveckling. Merge protection ska i stället kräva Trivy-resultatet och blockera nya high/critical-säkerhetsfynd.

CodeQL körs genom GitHubs Code Scanning default setup. Merge protection ska kräva en färdig CodeQL-analys och blockera nya säkerhetsfynd från medium och uppåt samt relevanta error/warning-fynd. GitHub Code Quality är en separat, avsedd CodeQL-baserad analys och ska inte tas bort bara för att båda funktionerna använder CodeQL; Code Quality ska vara mergegate för nya warning/error-fynd.

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
