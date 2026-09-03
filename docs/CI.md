# CI, deploy och release

## Required CI

Repositoryts required status checks är `CI / required` och `docker`.

`.github/workflows/ci.yml` producerar `CI / required` och verifierar appens låsta Node-beroenden, `npm run validate`, Wrangler dry-run för `log-archive` samt Python-koden under `kontakter/`.

`.github/workflows/docker.yml` producerar `docker`, bygger `kontakter/scraper`, kör Trivy och laddar SARIF till GitHub Code Scanning. Organisationens Trivy-ruleset blockerar security alerts från High och uppåt.

Organisationens `main`-ruleset kräver dessutom den centrala OSV-workflowen från `Avkroken/.github`. På vanliga pull requests kör den `scan-pr`; i merge queue kör den `scan-merge-group`. `scan-pr / osv-scan` är inte en separat organization-level required status check.

CodeQL merge protection, review-thread resolution, squash-only och övriga gemensamma merge-regler hanteras centralt av organisationens aktiva rulesets. Repositoryt använder merge queue.

## Security automation

GitHubs native Code Scanning, Copilot Autofix och Dependabot-funktioner ska användas före repositoryspecifika remediationkedjor. Repository-CI ska inte skapa remediation-branches eller PR:er, lagra egna säkerhetsalert-snapshots eller bygga en separat remediationkö.

## Production deploy

Cloudflare Workers Builds äger normal produktionsdeploy från `main`; GitHub Actions validerar men deployar inte produktion.

| Worker | Root directory | Deploy command |
| --- | --- | --- |
| `politiker` | `app` | `npm run migrate:production && npm run deploy && npm run verify:production` |
| `politiker-log-archive` | `log-archive` | `npm run deploy` |

Appen är ensam migrationsägare för D1 `politiker-eu`. `infra/migrations/` tillsammans med Wranglers `d1_migrations` är den enda migrationskedjan. `wrangler.jsonc` är source of truth för Worker-bindings, routes, queues, cron, tail consumers, required secret names och övrig versionshanterad Worker-konfiguration.

Workers Builds watch paths:

- `politiker`: `app/**`, `shared/**`, `infra/migrations/**`, `scripts/verify-production.mjs`
- `politiker-log-archive`: `log-archive/**`

## Release

`.github/workflows/release.yml` väljer exakta stabila `vX.Y.Z`-taggar som versionsbas. Nästa version bestäms av commits sedan senaste stabila tagg: breaking/`!`/`major:` → major, `feat:`/`minor:` → minor, `fix:`/`perf:`/`patch:` → patch. Övriga commits skapar ingen ny release.
