# AGENTS.md

## Läs först

- [docs/project-context.md](docs/project-context.md) — canonical runtime/current-state.
- [docs/architecture.md](docs/architecture.md) — Worker-, storage- och queuegränser.
- [docs/operations.md](docs/operations.md) — verifiering och incidentmodell.
- [docs/release-standard.md](docs/release-standard.md) — PR-title-, SemVer- och releasekontrakt; release och produktionsdeployment hålls separata.
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — repositoryspecifika coding-agent-instruktioner.
- Repositoryts egna README, `docs/`, workflows och versionerade konfiguration är auktoritativa för Politiker. Extern GitHub-/Cloudflare-live-state verifieras i respektive provider.

## Invariants

- Anta inte organization-scope eller andra org-funktioner utan live-verifiering.
- Utgå från aktuell default branch och arbeta i separat arbetsgren enligt `{agent}/{feature}/{date}`, där `date` skrivs som `YYYY-MM-DD`.
- Arbetet ska vara seriellt och semantiskt per repository: en arbetsgren/PR motsvarar en sammanhängande feature eller uppgift, och `feature`-delen ska beskriva arbetet semantiskt.
- Innan agenten påbörjar nästa uppgift i samma repository ska befintlig öppen arbetsgren, draft eller PR färdigställas genom relevanta checks, reviews och merge, eller uttryckligen avslutas/blockeras. Skapa inte tids-/ID-suffix eller parallella branchvarianter för att kringgå ett upptaget namn.
- Om `{agent}/{feature}/{date}` redan finns för uppgiften ska agenten fortsätta den befintliga arbetslinjen i stället för att skapa en ny.
- När kod ändå berörs: förenkla och sanitera det berörda området när det kan göras utan scope-expansion eller beteendeförändring. Ta bort död eller äldre kompatibilitetskod först när användningen är verifierat obefintlig; annars behåll och dokumentera gränsen.
- Commits ska använda Conventional Commits eller motsvarande tydlig typ, exempelvis `feat:`, `fix:`, `docs:`, `chore:`, `ci:` eller `test:`.
- Läs hela PR-review-state före merge, inklusive kommentarer och trådar som GitHub markerar som `outdated`; verifiera att grundproblemet faktiskt är löst.
- D1 är canonical application state; KV, R2, Queue och Durable Object har separata avgränsade roller.
- `CredentialRateLimiter` är serialiserad koordinationspunkt för mailcredential-rate limiting; ersätt inte den med oserialiserad process-/KV-state.
- D1-schemaändringar ska vara versionsstyrda migrationer i `infra/migrations/`.
- Kör `cd app && npm run validate` före merge för apprelaterade ändringar.
- Bevara query-string-redaction och central observability-policy.
- Lägg aldrig SMTP-/OAuth-credentials, API-nycklar, krypteringsnycklar eller andra secrets i repository, logs eller publik dokumentation.
## Agent skills

### Issue tracker

Use this repository's GitHub Issues for issues and specifications. Read `docs/agents/issue-tracker.md` before reading, creating, or publishing tickets.

### Domain docs

Use the single-context convention in `docs/agents/domain.md`; existing project-context, architecture, operations, and ADR documentation remain authoritative.

