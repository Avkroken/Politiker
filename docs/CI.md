# CI och branchflöde

## Grundmodell

Repositoryt använder endast `dev` och `main`.

1. Arbete görs på `dev`.
2. PR öppnas från `dev` till `main`.
3. PR-CI verifierar ändringen.
4. Auto-merge får merga när required checks är gröna.
5. Efter uppdatering av `main` fast-forwardar `.github/workflows/sync-dev.yml` automatiskt `dev` till `main`.
6. Synken använder aldrig force-push och avbryter om `dev` har omergat arbete.

Vanlig CI ska inte köras både som `push` till `dev` och `pull_request` för samma commit. CI körs därför på PR och på `push` till `main`.

## Selektiv CI

Repo:t har två tydliga språk-/komponentgränser:

- `app/**` och Node/TypeScript-konfiguration => appens TypeScript-CI.
- `kontakter/**` och Python-konfiguration => Python-CI.
- gemensam CI/dependency-konfiguration eller okänd påverkan => båda.
- dokumentation och agent/processmetadata => inga dyra språkjobb.

Required checks filtreras inte bort på workflow-nivå med `paths:`. Ett billigt impact-jobb klassificerar diffen och de befintliga required jobben använder job-level `if:`. Därmed behålls deras stabila checknamn samtidigt som irrelevant arbete kan hoppas över.

Routing ska fail-open: om påverkan inte kan avgöras säkert körs mer CI i stället för mindre.

## Deploy och säkerhet

Deploy sker från `main`, inte från `dev`. Säkerhetsskanning ska behålla stabila check-/Code Scanning-identiteter över namnbyten och refaktoreringar.

Målet är minsta säkra CI-mängd, inte minsta möjliga antal checks.