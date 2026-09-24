# Arkitektur

## Översikt

```text
Browser
  |
  v
access-index.ts
  |
  v
index.ts
  |     |       |        |          |
  |     |       |        |          +--> Email
  |     |       |        +------------> R2 attachments
  |     |       +---------------------> KV sessions
  |     +------------------------------> D1 application state
  |
  +--> Queue send jobs
          |
          +--> retries
          +--> dead-letter queue
          |
          v
     CredentialRateLimiter DO
          |
          v
       mail delivery
```

## Request boundary

`app/src/access-index.ts` är extern entrypoint. Requestpolicyn ska appliceras server-side innan applikationslogik eller assets svarar.

Känsliga API-svar ska fortsatt behandlas som icke-cachebar privat data.

## Auth och session

Sessioner ligger i KV, medan konton och övrig canonical applikationsstate ligger i D1. Det är en viktig gräns: sessioncache och persistent datamodell har olika konsistens- och livscykelkrav.

Authändringar måste verifiera:

- login/logout och sessionslivscykel,
- lösenords-/TOTP-flöden där de berörs,
- OAuth identity linking där det berörs,
- access till privata API-routes.

## D1

D1 är canonical datalager för applikationen. Queue, KV och Durable Objects ska inte skapa konkurrerande canonical kopior av samma affärsstate.

## Bilagor

R2 lagrar bilagor. D1 kan bära metadata/referenser medan objektbytes ligger i R2.

## Utskicksflöde

Ett utskick skapas som persistent applikationsstate och köas för asynkron bearbetning.

```text
persistent send state
        |
        v
     Queue
        |
        v
queue consumer
        |
        v
CredentialRateLimiter
        |
        v
provider / Email
```

Queue retries och DLQ representerar transport-/bearbetningsstate. Persistent D1-state behövs för att avgöra applikationens faktiska status.

## Rate limiting

`CredentialRateLimiter` använder Durable Object för serialiserad koordinering per credential/mailkonto. Den designen skyddar mot samtidiga Worker-invocations som annars skulle kunna överskrida avsedd leveranstakt.

## Cron

Cron-triggern kör varje minut och används för att fortsätta väntande arbete enligt applikationens körmodell. Cron ska inte introducera en separat state machine vid sidan av D1/queue.

## Trust boundaries

- Internet → accesslager
- session/token → authkontroll
- app → D1/KV/R2
- app → Queue
- queue consumer → rate limiter → mail/provider
- adminfunktioner → explicit authorization

## Failure model

Vid leveransproblem ska både persistent send state och queue/DLQ-state undersökas. Att bara återköra en queue-operation utan att förstå persistent state kan ge dubblerad eller felaktig behandling.
