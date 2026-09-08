# CI, deploy och release

## CI

`.github/workflows/ci.yml` producerar `CI / required` och verifierar appens låsta Node-beroenden, `npm run validate`, Wrangler dry-run för `log-archive` samt Python-koden under `kontakter/`.

`.github/workflows/docker.yml` producerar `docker`, bygger `kontakter/scraper`, kör Trivy och laddar SARIF till GitHub Code Scanning.

## Kodtäckning

`.github/workflows/github-coverage.yml` kör `app`-testerna med `c8` (Cobertura via `npm run test:coverage`) och `kontakter`-testerna med `pytest-cov` (`--cov --cov-report=xml`), och laddar upp båda rapporterna via `actions/upload-code-coverage`. Konfigurationen ligger i `app/.c8rc.json` respektive `kontakter/pyproject.toml`, så samma täckning kan köras lokalt.

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

`.github/workflows/release.yml` anropar den centrala Release Please-workflowen i `Avkroken/.github` på push till `main` och manuellt via `workflow_dispatch`.

Release Please håller en Release PR uppdaterad från Conventional Commits. `feat:` ger normalt minor, `fix:` patch och breaking changes major.

`release-please-config.json`, `.release-please-manifest.json` och `version.txt` håller repositoryts stabila SemVer-version. Den första migrerade basversionen är den redan publicerade `v0.8.13`.

När Release PR:n mergas skapas först en draft release. Innan publicering kompletterar den centrala workflowen Release Please-changelogen med en kort separat lista över dependency-bumpar och, via `.github/release-components.json`, en tabell över förstapartsprogrammen `politiker` och `politiker-log-archive`. Fullständiga dependency-listor hör inte hemma i release notes.
