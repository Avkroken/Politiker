# Dokumentation

Navigationssida för Politiker.

## Hitta rätt dokument

| Om du behöver… | Läs |
| --- | --- |
| förstå runtime, bindings och subsystem | [Projektkontext](project-context.md) |
| förstå requestflöden, state ownership och utskick | [Arkitektur](architecture.md) |
| utveckla, testa, migrera, deploya eller felsöka | [Drift](operations.md) |
| rapportera säkerhetsproblem | [SECURITY.md](../SECURITY.md) |

## Systemkarta

```text
Browser
  |
  v
app/src/access-index.ts
  |
  v
app/src/index.ts
  |
  +--> D1: application state + public contact registry
  +--> KV: sessions
  +--> R2: attachments
  +--> Queue: send jobs ---> DLQ
  +--> Durable Object: CredentialRateLimiter
  +--> Email binding
  +--> Static assets
```

En cron trigger kör varje minut för att fortsätta väntande arbete enligt applikationens modell.

## State ownership

- **D1**: canonical application state, inklusive `public_contacts` för politiker, media och akademiska mottagare.
- **KV**: sessionsstate.
- **R2**: bilagor.
- **Queue/DLQ**: leveransarbete och retry/failure state.
- **Durable Object**: serialiserad koordinering/rate limiting.
- **Assets**: presentation.

## Ändringskarta

- auth/session/API → architecture + tests
- D1-schema → migration + project-context + operations
- utskick/queue/rate limiting → architecture + operations
- R2/bilagor → architecture + storageverifiering
- bindings/routes/cron → project-context
- deploy/scripts → operations

## Wiki

GitHub Wiki är aktiverad och lämpar sig för klickbar presentation av dessa sektioner. Repositoryts Markdown är versionsstyrt underlag; unik current-state eller säkerhetskritisk information ska inte finnas enbart i Wiki.
