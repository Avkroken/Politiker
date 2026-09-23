# Arkitektur

## Översikt

```text
Browser
  |
  v
politiker.denied.se
  |
  v
Cloudflare Worker
  |   |   |   |   \
  |   |   |   |    +--> Email binding
  |   |   |   +------> R2 attachments
  |   |   +----------> KV sessions
  |   +--------------> D1 politiker-eu
  |
  +--> Queue politiker-send-jobs
          |
          v
      queue consumer
          |
          +--> CredentialRateLimiter DO
          +--> provider/mail delivery
```

## Request boundary

`app/src/access-index.ts` är extern entrypoint och routar vidare till applikationslogik/assets. API-responser för känsliga operationer ska fortsatt vara no-store.

## Stateful lager

- **D1** — canonical application data.
- **KV** — sessionsstate.
- **R2** — bilagor.
- **Queue** — leveransarbete och retries.
- **Durable Object** — serialiserad rate-limit/koordination per credential.

Queue och Durable Object kompletterar D1; de ersätter inte D1 som canonical application state.

## Utskicksflöde

Ett utskicksjobb skapas i applikationslagret, köas och bearbetas asynkront. CredentialRateLimiter samordnar leveranstakt för ett mailkonto även när flera queue-invocations kör samtidigt.

## Trust boundaries

Credentials som lagras eller används av applikationen ska hanteras via avsedd kryptering/runtime-secretmodell. API-nycklar, SMTP-lösenord och OAuth-secrets får inte exponeras i UI-respons, logs eller dokumentation.

## Failure model

Queue har retries och dead-letter queue. Fel ska därför observeras i både persistent jobbstate och queue-failure-state innan manuella omkörningar görs.
