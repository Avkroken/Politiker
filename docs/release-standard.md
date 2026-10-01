# Release- och versionsstandard

**Senast verifierad:** 2026-09-28

Det här dokumentet gäller **Politiker-repositoryt**. Repositoryts egna workflows, taggar och GitHub Releases äger release- och versionskontraktet.

## Versionsankare

Politiker använder immutable SemVer-taggar i formen `vMAJOR.MINOR.PATCH` som repositoryts canonical releaseversion. `app/package.json` är privat och är inte produktversionskälla.

## Release är inte deployment

Produktionsdeployment ägs fortsatt av Cloudflare Workers Builds. GitHub Release/tagg skapar ingen parallell Cloudflare-deployväg och releaseworkflown använder inga användarkonfigurerade Cloudflare-credentials.

## PR-titlar och merge queue

PR-titlar ska följa Conventional Commits:

```text
<type>[optional scope][!]: <description>
```

Tillåtna typer är `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore` och `revert`.

`.github/workflows/pr-title.yml` validerar pull requests och rapporterar samma check-context på `merge_group`. Workflown använder inga secrets och har `permissions: {}`.

## SemVer

Automatisk versionsberäkning följer:

- breaking change -> **major**;
- `feat` -> **minor**;
- `fix`, `perf` och `revert` -> **patch**;
- `refactor`, `docs`, `test`, `build`, `ci` och `chore` skapar normalt ingen release ensamma;
- `Release-As: major|minor|patch|none` kan uttryckligen klassificera en icke-breaking ändring;
- breaking change kan aldrig sänkas under major.

## Automatiskt releaseflöde

`.github/workflows/release.yml` äger releaseprocessen lokalt:

```text
PR
  -> Conventional Commit-kompatibel PR-titel
  -> normal CI/review
  -> merge till main
  -> Node and Cloudflare + Python + Docker verifierar samma main-SHA
  -> semantic release beräknar SemVer
  -> immutable tagg
  -> GitHub Release med genererad changelog
```

Releasejobbet kör endast på `main`, använder full first-parent-historik, kräver checks i `.github/release-required-checks`, väntar på exakt release-target SHA och vägrar divergerande/stale releasehistorik.

En merge utan releasevärdig förändring skapar ingen release.

## Prerelease

Manuell `workflow_dispatch` kan skapa `vMAJOR.MINOR.PATCH-rc.N`. Promotion till stable använder den aktiva RC:ns commit och tar inte med senare `main`-commits implicit.

## Changelog

GitHub Releases är canonical versionerad changelog. Breaking changes markeras tydligt men behåller sin relevanta grundkategori.

## Credentials

Releasejobbet använder repositoryts `GITHUB_TOKEN` med least privilege: read för checks/status och `contents: write` endast för tagg/GitHub Release. Ingen PAT eller bredare GitHub App-writebehörighet behövs.

## Hotfix och rollback

Publicerade taggar flyttas inte. Korrigering går via vanlig PR, normal verifiering och en ny SemVer-release. Ingen force-push eller tag history rewrite används.

### Copilot-sammanfattning

Releaseflödet kan komplettera den deterministiska changelogen med en AI-genererad, användarorienterad sammanfattning via den SHA-pinnade `github/copilot-release-notes`-actionen. Sammanfattningen är **supplemental**: SemVer, release-target, required checks och den deterministiska changelogen ändras inte av Copilot.

Copilot-steget använder endast repository-secret `COPILOT_GITHUB_TOKEN`, som ska vara en least-privilege fine-grained PAT med `Copilot Requests: Read` och en tokenägare med aktiv Copilot-licens. Om secreten saknas eller Copilot-steget misslyckas fortsätter releasen med enbart den deterministiska changelogen. Ingen credential skapas eller roteras av releaseworkflown.

AI-texten blockciteras under `## Copilot summary` efter den deterministiska changelogen. Därmed fortsätter Portalens kategoriutvinning att baseras på de verifierade release-rubrikerna och AI-texten blir inte en alternativ source of truth.
