# CI, deploy och release

## Branchflöde

`main` är huvudgrenen och tar bara emot ändringar via PR. Arbete görs på den återanvändbara grenpoolen `work/feature`, `work/fix`, `work/chore` samt `docs/content` för ändringar inom dess särskilda dokumentationsscope. Skapa inte kortlivade engångsgrenar.

PR öppnas mot `main` och auto-merge aktiveras omedelbart. Required checks, relevanta review-trådar och merge queue avgör när PR:n får mergas. **Squash merge är den enda tillåtna merge-metoden.** Efter merge synkroniserar repositoryts pool-workflow arbetsgrenarna tillbaka mot aktuell `main`.

Vanlig CI körs på `pull_request` och på push till `main` där efter-merge-verifiering behövs.

## Selektiv CI

- `app/**` och Node/TypeScript-konfiguration påverkar appens TypeScript-CI.
- `kontakter/**` och Python-konfiguration påverkar Python-CI.
- Gemensam CI-/dependency-konfiguration eller okänd påverkan kör båda.
- Dokumentation och processmetadata behöver normalt inte starta dyra språkjobb.

Required checks filtreras inte bort på workflow-nivå med `paths:`. Ett impact-jobb klassificerar diffen och efterföljande jobb använder job-level `if:`. Routing ska vara fail-open: om påverkan inte kan avgöras säkert körs mer CI.

## Deploy och release

Produktionsdeploy sker från `main`. `.github/workflows/release.yml` bestämmer nästa SemVer-version från commitmeddelanden sedan senaste `vX.Y.Z`-taggen: breaking/`major:` ger major, `feat:`/`minor:` ger minor och `fix:`/`perf:`/`patch:` ger patch. Övriga commits skapar ingen release om ingen release-utlösande commit finns.

## Säkerhet

Säkerhetsskanning ska behålla stabila required-check- och Code Scanning-identiteter. Målet är minsta säkra CI-mängd, inte minsta möjliga antal checks.
