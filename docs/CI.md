# CI, deploy och release

## Branchflöde

`main` tar bara emot ändringar via pull request. Arbete görs på kortlivade branches; repositoryt använder inte merge queue.

Öppna en ready PR mot `main` och aktivera auto-merge omedelbart. Live-ruleseten kräver `typecheck`, `python`, lösta review-trådar och squash merge. Direkt merge används bara när det uttryckligen begärts.

## Selektiv CI

- `app/**` och Node/TypeScript-konfiguration påverkar appens TypeScript-CI.
- `kontakter/**` och Python-konfiguration påverkar Python-CI.
- Gemensam CI-/dependency-konfiguration eller okänd påverkan kör båda.
- Dokumentation och processmetadata behöver normalt inte starta dyra språkjobb.

Required checks filtreras inte bort på workflow-nivå med `paths:`. Ett impact-jobb klassificerar diffen och efterföljande jobb använder job-level `if:`. Routing är fail-open: om påverkan inte kan avgöras säkert körs mer CI.

Required `typecheck` kör appens tester, native D1-migrationer mot lokal D1, TypeScript typecheck, Wrangler dry-run, produktionsverifierarens Node-test och separat Wrangler dry-run av `log-archive`. GitHub Actions innehåller ingen produktionsdeploykedja.

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

## Säkerhet

OSV och Docker/Trivy kör kompletterande säkerhetskontroller. Code Scanning-identiteter ska hållas stabila. En grön Docker/Trivy-workflow betyder inte automatiskt noll fynd eftersom Trivy-resultat rapporteras via SARIF; finding-count och alert-livscykel ska verifieras när säkerhetsfixar görs.
