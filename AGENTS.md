# AGENTS.md

## Läs först

- [docs/project-context.md](docs/project-context.md) — canonical runtime/current-state.
- [docs/architecture.md](docs/architecture.md) — Worker-, storage- och queuegränser.
- [docs/operations.md](docs/operations.md) — verifiering och incidentmodell.
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — repositoryspecifika coding-agent-instruktioner.
- [Avkrokens centrala engineering- och dokumentationsstandard](https://github.com/Avkroken/Avkroken/tree/main/docs/organization) — central CI/governance och dokumentationsmodell.

## Invariants

- Arbeta i separat gren enligt `{agent}/{feature}/{YYYY-MM-DD}/{HH-mm}-{id}`.
- D1 är canonical application state; KV, R2, Queue och Durable Object har separata avgränsade roller.
- `CredentialRateLimiter` är serialiserad koordinationspunkt för mailcredential-rate limiting; ersätt inte den med oserialiserad process-/KV-state.
- D1-schemaändringar ska vara versionsstyrda migrationer i `infra/migrations/`.
- Kör `cd app && npm run validate` före merge för apprelaterade ändringar.
- Bevara query-string-redaction och central observability-policy.
- Lägg aldrig SMTP-/OAuth-credentials, API-nycklar, krypteringsnycklar eller andra secrets i repository, logs eller publik dokumentation.
