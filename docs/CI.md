# CI, deploy och release

## Branchflöde och live merge-policy

`main` tar bara emot ändringar via pull request och endast squash merge är tillåtet. Arbete görs på kortlivade branches; repositoryt använder inte merge queue.

Organisationens aktiva rulesets är verkställande sanning. Vid senaste live-verifieringen krävs:

- `CI / required`;
- `docker`;
- `scan-pr / osv-scan`;
- strict required status checks mot aktuell `main`;
- 1 approval;
- stale approvals avfärdas efter push;
- last-push approval från någon annan än senaste pushern;
- resolved review threads;
- CodeQL Code Scanning protection (`medium_or_higher` security alerts, `errors_and_warnings` alerts);
- Trivy Code Scanning protection för `high_or_higher` security alerts;
- squash merge, utan bypass actors.

Copilot Code Review och CodeRabbit är rådgivande. Faktiska relevanta findings ska hanteras, men quota/rate-limit/tillfälligt tjänstefel är inte i sig en required status check.

Org-rulesetet `main` refererar fortfarande till Regelverkets `.github/workflows/osv-scanner.yml` som central required workflow. Det är organisationsnivå och måste ändras separat när den centrala OSV-kopplingen tas bort.

## Repository-CI

`.github/workflows/ci.yml` producerar `CI / required` och kör repositoryts faktiska verifiering direkt på varje PR:

- appens låsta Node-beroenden och `npm run validate`;
- separat Wrangler dry-run för `log-archive`;
- Python-beroenden under `kontakter/`, compileall och tester när testkatalog finns.

Workflowen använder inte en repositoryspecifik impact-router. Det betyder att required-gaten verifierar båda huvudsakliga kodytorna på varje PR i stället för att försöka klassificera diffen.

`.github/workflows/docker.yml` producerar `docker`. Den bygger `kontakter/scraper` på varje PR/run, kör Trivy vulnerability scanning och laddar SARIF till Code Scanning. Trivy-processen har exit code 0; mergeblockering av nya High/Critical-fynd verkställs av organisationens Trivy Code Scanning-ruleset. Workflowen använder alltså inte längre en konstgjord tom-SARIF-väg för opåverkade PR:er.

`.github/workflows/osv-scanner.yml` är repositoryts egen OSV-definition. PR-jobbet producerar `scan-pr / osv-scan`; `main`/schedule/manual används för kompletterande rapportering.

GitHub Actions deployar inte Cloudflare-produktion och skapar/uppdaterar inte branches eller PR:er, armerar inte auto-merge och delegerar inte remediation.

## Cloudflare-owned production deploy

Cloudflare Workers Builds äger normal produktionsdeploy från `main`; GitHub Actions validerar men deployar inte produktion.

| Worker | Root directory | Deploy command |
| --- | --- | --- |
| `politiker` | `app` | `npm run migrate:production && npm run deploy && npm run verify:production` |
| `politiker-log-archive` | `log-archive` | `npm run deploy` |

Appens `deploy` är direkt `wrangler deploy --strict --outdir dist`; `log-archive` använder direkt `wrangler deploy --strict`. Appen är ensam migrationsägare för D1 `politiker-eu`, och `infra/migrations/` med Wranglers `d1_migrations` är den enda migrationskedjan/state-modellen.

Efter app-deploy kör `npm run verify:production`, som endast verifierar att `https://politiker.denied.se/` svarar HTTP 200. `log-archive` är en tail-konsument och behöver ingen konstgjord publik health-route.

Workers Builds watch paths ska vara:

- `politiker`: `app/**`, `shared/**`, `infra/migrations/**`, `scripts/verify-production.mjs`;
- `politiker-log-archive`: `log-archive/**`.

`wrangler.jsonc` är source of truth för Worker-bindings, routes, queues, cron, tail consumers, required secret names och övrig versionshanterad Worker-konfiguration. Secrets ligger utanför repositoryt.

## Release

`.github/workflows/release.yml` serialiserar releasekörningar och väljer endast exakta stabila `vX.Y.Z`-taggar som versionsbas. Nästa version bestäms från commitmeddelanden sedan senaste stabila taggen:

- breaking change, `!` eller `major:` → major;
- `feat:` eller `minor:` → minor;
- `fix:`, `perf:` eller `patch:` → patch;
- övriga commits skapar ingen ny release.

Releasen riktas mot den aktuella `main`-SHA:n och skapas med GitHubs genererade release notes.
