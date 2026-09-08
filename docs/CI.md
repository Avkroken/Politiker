# CI, deploy och release

## CI

Förrådet använder bara officiella GitHub-startermallar för CI-workflows:

- `.github/workflows/node.js.yml` → `Node.js CI / build (24.x)`  
  Anpassning: kör i `app/` och använder `app/package-lock.json` för cache.
- `.github/workflows/docker-image.yml` → `Docker Image CI / build`  
  Anpassning: bygger `kontakter/scraper` med `kontakter/scraper/Dockerfile`.
- `.github/workflows/dependency-review.yml` → `Dependency review / dependency-review`

GitHub Code Scanning default setup hanterar CodeQL. Därför finns ingen lokal `codeql.yml`.

Dependabot ligger i `.github/dependabot.yml` och uppdaterar npm, GitHub Actions, Docker och pip veckovis.

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

Ingen lokal `release.yml` används. Det finns ingen direkt startermall som ersätter repoets tidigare release-please-flöde.

`release-please-config.json`, `.release-please-manifest.json` och `version.txt` finns kvar som versionsmetadata, men utan lokal release-workflow körs ingen release-automation från GitHub Actions i detta repo.
