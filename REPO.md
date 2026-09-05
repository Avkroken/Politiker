# REPO.md

This is the repository governance document for `Avkroken/Politiker`. Binding AI coding-agent policy is defined only in `Avkroken/.github/AGENTS.md`. This document records repository-specific technical contracts, invariants, validation requirements, and operational context required by that policy; it must not define, supplement, narrow, or override agent policy.

## Repository architecture

`politiker` is a web service where users connect their own mail account and send personalized messages to elected representatives.

- `app/`: Cloudflare Worker with `fetch`, `queue` and `scheduled` handlers.
- `log-archive/`: Tail Worker that archives `app/` log events to R2.
- `shared/`: shared validation, encryption, SMTP, Graph and types.
- `infra/migrations/`: Wrangler-native D1 migrations.
- `kontakter/`: separate Python collection, normalization and verification of contact data.

Cloudflare D1 is the canonical runtime data source. Git must not be used as a production database, D1 snapshot or alternate Cloudflare control plane.

## Cloudflare control plane

- `app/wrangler.jsonc` is the source of truth for versioned Worker configuration.
- Secret values live in Cloudflare and must not be hardcoded or duplicated into GitHub Actions.
- Cloudflare Workers Builds owns normal production deployment from `main`; GitHub Actions must not duplicate production deployment.
- Worker `politiker` uses root `app` and deploy command `npm run migrate:production && npm run deploy && npm run verify:production`.
- Worker `politiker-log-archive` uses root `log-archive` and deploy command `npm run deploy`.
- The app Worker is the sole D1 migration owner. Schema changes use Wrangler-native D1 migrations under `infra/migrations/`.
- Do not introduce parallel migration engines, deployment wrappers or GitHub Actions that mutate production D1.

## Contact data

`kontakter/` is a data producer, not a Cloudflare control plane. It collects and maintains public recipient contacts.

### Architecture and data ownership

Cloudflare D1 is the only canonical runtime data source for contact data.

- Do not export live D1 back into Git.
- Do not commit CSV/JSON/SQL snapshots of the production database.
- GitHub Actions must not write directly to production D1 as a substitute for the contact-data tooling.
- Contact tooling must not provision schema, resources or Workers.
- D1-writing helper scripts use the minimum necessary API token and may modify contact data only.

### Tech stack

- Python 3
- Playwright/headless Chromium for browser-required sources
- `pypdf` for PDF-based representative lists
- Docker/Docker Compose for the heavier municipality/region scraper

### Structure

```text
kontakter/scraper/scraper.py             municipality/region main logic
kontakter/scraper/regioner.json          source configuration
kontakter/scraper/politiker_common.py    shared normalization helpers
kontakter/scraper/d1.py                  limited D1 client for contact data
kontakter/scraper/sync_to_d1.py          municipality/region -> D1
kontakter/scraper/backfill_assignments.py organizations/committees -> D1
kontakter/scraper/fetch_*.py             other external sources -> D1
kontakter/scraper/quarterly_refresh.sh    orchestrates full contact refresh
kontakter/verify/                        verification tools
kontakter/resultat/                      local scraper/review artifacts
```

### D1 configuration

Scripts that need D1 use `kontakter/scraper/d1.py` (`D1Client`). Canonical environment variables are:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN_POLITIKER`
- `D1_DATABASE_UUID`

Backward-compatible aliases may remain only while required by a verified runtime. Do not add new aliases to mask configuration drift.

### Contact-data model and refresh rules

- Normalize each source to the minimum useful recipient data: name, email, area/level, party when verifiable, and relevant organization/topic association.
- Do not elevate raw administrative job titles into separate public filters.
- `kontakter/resultat/` contains local working artifacts for review/import; it is not a production backup or source of truth.
- `quarterly_refresh.sh` is the full contact refresh. It runs separately from Worker deployment and must not receive permissions to change Cloudflare resources, Worker configuration or D1 schema.
- Prefer official sources and deterministic normalization.
- A scraper must not provision infrastructure to solve a data-quality problem.
- D1 schema changes belong to the repository migration flow under `infra/`, not the Python scripts in `kontakter/`.
- Long-running jobs should checkpoint locally per source/region so they can resume without creating a second production database.
- TLS validation must not be weakened in committed code.

## GitHub Actions contract

- `.github/workflows/ci.yml` owns `CI / required` and verifies app/log-archive plus Python tooling under `kontakter/`.
- `.github/workflows/docker.yml` owns `docker`, builds `kontakter/scraper` and uploads Trivy SARIF.
- `.github/workflows/release.yml` invokes the pinned Release Please workflow from `Avkroken/.github`. Changes accumulate in a Release PR that passes normal checks and merge queue; only the merged Release PR creates and publishes the next GitHub Release.
- `release-please-config.json`, `.release-please-manifest.json` and `version.txt` are the repository release-version contract. `.github/release-components.json` lists the two first-party Workers shown in release notes.
- Pin third-party GitHub Actions to full commit SHAs.

## Application security invariants

- Every account-owned database query must filter on `account_id`; admin endpoints require explicit admin authorization.
- `MAIL_CRED_KEY`, SMTP passwords, OAuth secrets, TOTP secrets and session tokens are sensitive.
- Prefer least privilege and provider-native mechanisms over custom wrappers.

## Response format

Read and follow `SKILLS.md` when working in this repository.
