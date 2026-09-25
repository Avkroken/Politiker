# Projektkontext

**Senast verifierad:** 2026-09-25

## Ansvar

Politiker är en stateful Cloudflare Worker-applikation för:

- användarkonton och authentication,
- kontakt-/mottagardata,
- privata kontaktlistor,
- brev och bilagor,
- utskicksjobb,
- provider/mail credentials,
- feedback och administration.

Den kodnära current-state-källan är `app/wrangler.jsonc`, `app/src/` och D1-migrationerna under `infra/migrations/`.

## Runtime

`app/wrangler.jsonc` definierar:

- Worker `politiker`
- entrypoint `app/src/access-index.ts`
- custom domain `politiker.denied.se`
- static assets under `app/public/`
- D1 binding `DB`
- KV binding `SESSIONS`
- Queue producer/consumer `SEND_QUEUE`
- dead-letter queue
- Durable Object binding `RATE_LIMITER`
- R2 binding `ATTACHMENTS`
- Cloudflare Email binding `EMAIL`
- cron varje minut
- persistent observability med query-string-redaction.

## Kodansvar

### Accesslager

`app/src/access-index.ts` är extern requestgräns och ligger framför den huvudsakliga applikationslogiken/assets.

### Applikationslager

`app/src/index.ts` hanterar bland annat auth, konton, API-nycklar, kontaktdata, brev, bilagor, utskick, queue-konsumtion, feedback och adminfunktioner.

## State ownership

### D1

Canonical application state, inklusive data som måste överleva enskilda Worker-invocations.

Det gemensamma offentliga mottagarregistret ligger i `public_contacts`. `area_type` skiljer bland annat politiska nivåer, media och `academia`. Akademiska poster kan dessutom bära `organisation`, `unit`, `title`, `academic_field` och `source_url`. De tre aktuella akademiska fälten är statsvetenskap, offentlig förvaltning och offentlig rätt/förvaltningsrätt.

Kommun-/regionkopplingar till nämnder och styrelser ligger i `public_contact_assignments`. Migration `0003_generalize_public_contacts.sql` behåller temporära legacy-vyer för de tidigare tabellnamnen så att den gamla Worker-versionen kan fortsätta läsa under en kontrollerad migration.

### KV

Sessionsstate. KV ska inte användas som ersättning för relationell canonical data.

### R2

Bilagor och objektdata. Objektinnehåll ska inte flyttas in i loggning eller dokumentation.

### Queue och DLQ

Asynkront leveransarbete. Queue-state kompletterar persistent jobbstate; det ersätter det inte.

### Durable Object

`CredentialRateLimiter` är serialiserad koordinationspunkt för credential-/mailkontobaserad leveranstakt. Detta får inte ersättas av oserialiserad processlokal state.

## Migrationer

D1-migrationer ligger i `infra/migrations/`. Wrangler pekar explicit på den katalogen och migrations-tabellen.

Schemaändringar ska göras som versionerade migrationer.

## Secrets och credentials

Kod och docs får beskriva secret-namn och ansvar men aldrig värden. Credentialflöden ska behålla sina avsedda krypterings- och runtimegränser.

## Observability

Persistent logs/traces är aktiverade med sampling och query-string-redaction. Auth-/API-flöden kan bära känsliga parametrar; redaction är därför en driftinvariant.

## Dokumentationsgräns

Denna fil dokumenterar repo-specifik current-state. Organisationsgemensam GitHub-governance och privata operativa detaljer hör inte hemma här.

## Uppdateringskontrakt

Uppdatera filen när bindings, queue-/rate-limitmodell, D1-schema, authmodell, storage, cron eller deploymentmodell ändras.
