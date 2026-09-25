# Release- och versionsstandard

**Senast verifierad:** 2026-09-25

Det här dokumentet gäller **Avkroken/Politiker**. Repositoryts egna workflows och dokumentation äger release-, deploy- och versionskontraktet.

## Nuvarande versionsmodell

Politiker är en publik Cloudflare-applikation. `app/package.json` är `private: true` och saknar `version`; det är därför inte en produktversionskälla.

Repositoryt har ingen verifierad canonical lokal appversionsfil på current `main`. Inför inte `version.txt` eller package-version enbart för releaseautomation.

Versionerade releases förankras i SemVer-taggar:

```text
vMAJOR.MINOR.PATCH
```

GitHub Release ska referera samma tagg.

## Release är inte deployment

Produktionsdeployment ägs av `.github/workflows/deploy-production.yml`.

Verifierat current-state:

- workflowen är endast `workflow_dispatch`;
- den får bara köras från `main`;
- den kör applikationsvalidering;
- applicerar väntande D1-migrationer;
- deployar Worker;
- synkar akademikontakter;
- verifierar datasynk och publik ingress;
- `concurrency` tillåter inte parallella produktionsdeployments.

En GitHub tagg eller GitHub Release får **inte** automatiskt köra detta flöde utan ett separat, verifierat deploymentbeslut. Releaseversion och produktionsdeployment är två olika händelser.

## PR-titlar och squash commits

PR-titlar ska följa Conventional Commits:

```text
<type>[optional scope][!]: <description>
```

Tillåtna typer:

- `feat`
- `fix`
- `perf`
- `refactor`
- `docs`
- `test`
- `build`
- `ci`
- `chore`
- `revert`

Scope är valfri, exempelvis `auth`, `queue`, `contacts`, `preview`, `storage` eller `deps`.

`!` markerar breaking change:

```text
feat(api)!: replace public request contract
```

`.github/workflows/pr-title.yml` validerar titeln på vanlig `pull_request`. Workflown använder inga secrets, checkar inte ut kod och har `permissions: {}`.

Aktuell Dependabot-historik använder redan kompatibla titlar som `build(deps): ...`.

## SemVer

Vid versionerad release:

- breaking change → **major**;
- `feat` → normalt **minor**;
- `fix` → normalt **patch**;
- `docs`, `test`, `chore`, `ci` och `build` → normalt ingen release ensamma;
- `perf` och `refactor` bedöms efter faktisk produkt-/API-effekt.

Releaseversionen är inte en Cloudflare Worker-version eller deploymenträknare.

## När release ska ske

Release sker kuraterat, inte på varje merge eller deployment.

En release är motiverad när:

- användar-/operatörsfunktionalitet är färdig;
- en fix behöver en officiell versionspunkt;
- auth/API/data-/leveranskontrakt ändras på ett sätt konsumenter behöver kunna referera;
- en breaking förändring kräver ny major-version.

## Release-PR-målbild

```text
main changes
  -> Conventional Commit-historik
  -> release-PR
  -> release notes + vald SemVer
  -> ordinarie CI
  -> merge
  -> vMAJOR.MINOR.PATCH tag
  -> GitHub Release
  -> separat explicit production deployment när den faktiskt ska ske
```

Release-PR får inte köra produktionsmigrationer eller produktionsdeploy implicit.

## Verifiering vid release

Minst vanlig repository-CI ska vara grön.

För appdelen:

```bash
cd app
npm ci
npm run validate
```

`validate` omfattar tester, produktionsverifieringstester, frontend-syntax, lokal D1-migration, Wrangler types, TypeScript och `wrangler deploy --dry-run`.

Releasearbete som berör D1/deployment måste dessutom följa ordningen och säkerhetsgränserna i [operations.md](operations.md).

## Releaseautomation — current state

Targeted current-main-verifiering hittade ingen Release Please- eller `action-gh-release`-workflow.

Release Please kan tekniskt skapa release-PR/tagg/GitHub Release från Conventional Commits men är inte aktiverat. Standardmodellen med repositoryts `GITHUB_TOKEN` triggar inte efterföljande Actions-workflows på bot-skapade PR:er/taggar, vilket skulle ge release-PR utan normal CI.

Upstreamreferens: `https://github.com/googleapis/release-please-action#other-actions-on-release-please-prs`.

Följande används inte som genväg:

- ny PAT utan separat credentialbeslut;
- bredare GitHub App-writebehörighet;
- lättade CI-/review-/repositoryskydd;
- koppling av releaseautomation direkt till produktionsdeployment.

Full releaseautomation är blockerad tills ett least-privilege CI-kompatibelt write-identitetsflöde eller annan säker modell väljs.

## CHANGELOG och release notes

Det finns ingen root `CHANGELOG.md` på verifierad current `main`.

GitHub Releases är den versionerade releasehistoriken för Portalens Changelog. En framtida versionsstyrd changelog får genereras i samma release-PR-process men ska inte bli en separat manuellt underhållen source of truth.

## Prerelease

Prereleases används endast vid konkret behov, exempelvis `v2.0.0-rc.1`. En prerelease ska inte automatiskt deployas till produktion.

## Hotfix och rollback

Hotfix utgår normalt från aktuell `main` och använder `fix:` när ändringen är bakåtkompatibel.

Publicerade taggar flyttas inte. Vid felaktig release:

1. korrigera/revert:a via vanlig PR;
2. kör normal verifiering;
3. skapa ny SemVer-version/tagg/GitHub Release;
4. deploya endast om den korrigerade versionen faktiskt ska till produktion;
5. följ D1-/deployment-/ingressverifiering enligt operations.

Ingen force-push eller tag history rewrite används.

## Kvarvarande blocker

Full releaseautomation är separat arbete. Den får inte skapa nya onödiga credentials, bredda read-only integrationer eller koppla release direkt till produktionsmigrering/deploy utan separat arkitekturbeslut.
