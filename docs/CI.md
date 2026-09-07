# CI, deploy och release

## CI

`.github/workflows/node.js.yml` producerar `Node.js CI / build (24.x)` och kör `npm ci`, eventuell build (`npm run build --if-present`) samt tester (`npm test`) i `app/`.

`.github/workflows/docker-image.yml` producerar `Docker Image CI / build` och bygger `kontakter/scraper` med repositoryts Dockerfile.

`.github/workflows/codeql.yml` kör GitHubs standardflöde för CodeQL-analys av `javascript-typescript`.

`.github/workflows/dependency-review.yml` kör GitHubs standardflöde för dependency review på pull requests.

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

Ingen repository-lokal `release.yml` används nu. Tidigare release-please-workflow togs bort och har ingen direkt GitHub-standardmall i `actions/starter-workflows`.

`release-please-config.json`, `.release-please-manifest.json` och `version.txt` finns kvar som versionsmetadata, men utan lokal release-workflow körs ingen release-automation från GitHub Actions i detta repo.

Dependabot-konfigurationen ligger i `.github/dependabot.yml` och hanterar uppdateringar för npm, GitHub Actions, Docker och pip.
