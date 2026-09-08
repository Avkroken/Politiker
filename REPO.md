# REPO.md

`Politiker` är en Cloudflare Worker-applikation med delad runtime-kod, D1-migreringar, en loggarkiv-Worker och Python-verktyg för kontaktdata under `kontakter/`.

## Runtime och dataägande

- Cloudflare D1 är kanonisk runtime-datakälla. Använd inte Git som produktionsdatabas och exportera inte live-D1-snapshots till förrådet.
- `app/wrangler.jsonc` är källa till sanning för versionshanterad Worker-konfiguration.
- Produktionsdistribution från `main` hanteras av Cloudflare Workers Builds.
- App-Workern är ensam ägare av D1-migreringar. Schemaändringar använder Wrangler-migreringar under `infra/migrations/`.
- `kontakter/` får samla in och uppdatera kontaktdata men ska inte provisionera Workers/resurser eller äga D1-schemaändringar.

## Säkerhetsinvarians

- Alla databasfrågor för kontobunden data ska filtrera på `account_id`.
- Admin-endpoints kräver uttrycklig server-side admin-auktorisering.
- Credentials, OAuth/session/TOTP-hemligheter och mail-krypteringsnycklar får inte committas, loggas eller skickas till klienter.
- Kontaktdata-verktyg ska använda minsta nödvändiga behörighet.
- TLS-validering får inte försvagas.

## GitHub-styrning

- Kanonisk arbets- och reviewpolicy finns i `Avkroken/.github/AGENTS.md`.
- `main` skyddas av det ärvda organisationsrulesetet `main` och repo-rulesetet `required-ci`.
- Required checks på `main` är `Node.js CI / build (24.x)`, `Node.js CI / log-archive`, `Docker Image CI / build`, `Docker Image CI / python-tests` och `Dependency review / dependency-review`.
- Repo-rulesetet `required-ci` kräver dessutom uppdaterad branch mot base, minst en approval, lösta review-trådar, signerade commits samt blockerar force-push och branch-radering.
- CI-workflows i detta repo ska vara officiella GitHub-startermallar, med endast nödvändig repoanpassning.
- `dev` är integrationsgren när ett aktivt `dev-pilot`-ruleset finns. Lägg endast required status checks på `dev` när workflows bevisligen producerar exakt de check-namnen för PR mot `dev`.
- Organisationens CodeRabbit-UI är baslinje. Repository-lokal `.coderabbit.yaml` ska endast användas för uttryckligen repo-specifika overrides.

## Validering

Kör relevanta Worker- och Python-tester för berörd del. Validera migreringar och Wrangler-konfiguration när de ändras.
