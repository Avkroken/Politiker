# CI, deploy och release

## Branchflöde

Repositoryt använder endast `dev` och `main`.

1. Arbete görs på `dev`.
2. PR öppnas från `dev` till `main`.
3. PR-CI verifierar ändringen och required checks måste bli gröna.
4. Auto-merge sammanfogar PR:n när reglerna tillåter det.
5. Efter uppdatering av `main` fast-forwardar `.github/workflows/sync-dev.yml` automatiskt `dev` till `main` när `dev` saknar omergat arbete.

Vanlig CI körs på `pull_request` och på `push` till `main`, inte dessutom på varje push till `dev`.

## Selektiv CI

- `app/**` och Node/TypeScript-konfiguration påverkar appens TypeScript-CI.
- `kontakter/**` och Python-konfiguration påverkar Python-CI.
- Gemensam CI-/dependency-konfiguration eller okänd påverkan kör båda.
- Dokumentation och agent/processmetadata behöver normalt inte starta dyra språkjobb.

Required checks filtreras inte bort på workflow-nivå med `paths:`. Ett impact-jobb klassificerar diffen och efterföljande jobb använder job-level `if:`. Routing ska vara fail-open: om påverkan inte kan avgöras säkert körs mer CI, inte mindre.

## Deploy

`.github/workflows/deploy.yml` kör produktion från `main`. Före Worker-deploy körs `infra/apply-migrations.sh`, som applicerar endast migrationsfiler som ännu inte finns registrerade i D1-tabellen `schema_migrations`.

## Automatisk release

`.github/workflows/release.yml` kör på uppdateringar av `main` och bestämmer nästa SemVer-version från commitmeddelanden sedan senaste `vX.Y.Z`-taggen.

- `BREAKING CHANGE:`, `type!:` eller `major:` → major.
- `feat:` eller `minor:` → minor.
- `fix:`, `perf:` eller `patch:` → patch.
- Övriga commits, exempelvis `docs:` och `chore:`, skapar ingen release om det inte också finns en release-utlösande commit sedan senaste taggen.

När en bump behövs skapas nästa GitHub Release och tagg automatiskt med genererade release notes. Versionsnummer ska alltså inte taggas manuellt i normalfallet.

## Säkerhet

Säkerhetsskanning ska behålla stabila check- och Code Scanning-identiteter över namnbyten och refaktoreringar. Målet är minsta säkra CI-mängd, inte minsta möjliga antal checks.
