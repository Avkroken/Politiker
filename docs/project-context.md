# Projektkontext

**Senast verifierad:** 2026-09-23

## Ansvar

Politiker är en stateful Cloudflare Worker-applikation för användarkonton, kontakt-/mottagardata, brev/utskicksjobb, bilagor och relaterad administration.

Den publika/applikationsnära current-state-källan är `app/wrangler.jsonc` tillsammans med `app/src/` och D1-migrationerna i `infra/migrations/`.

## Runtime

Verifierad produktionstopologi:

- Worker: `politiker`
- entrypoint: `app/src/access-index.ts`
- domain: `politiker.denied.se`
- assets: `app/public/`
- D1: `DB -> politiker-eu`
- KV: `SESSIONS`
- Queue: producer/consumer `politiker-send-jobs`
- dead-letter queue: `politiker-send-jobs-dlq`
- Durable Object: `CredentialRateLimiter` med SQLite-storage
- R2: `ATTACHMENTS -> politiker-attachments`
- Email binding: `EMAIL`
- cron: varje minut

## Applikationsansvar

`app/src/index.ts` hanterar bland annat:

- kontoregistrering, login, lösenordsflöden och TOTP,
- OAuth identity linking,
- API-nycklar,
- kontakt-/mottagardata,
- privata kontaktlistor,
- mail credentials,
- brevdata och bilagor,
- utskicksjobb och kökonsumtion,
- feedback och felrapportering,
- adminfunktioner.

## Rate limiting

Mailkonto-baserad koordinering sker i `CredentialRateLimiter`. Durable Object används för att få en serialiserad koordinationspunkt där D1/KV inte i sig ger motsvarande samtidighetsgaranti.

Ändringar i utskickskoncurrency eller rate limiting måste verifieras mot den här modellen; den får inte ersättas med oserialiserad lokal state.

## Data och migrationer

D1-migrationerna ligger under `infra/migrations`. Wrangler-konfigurationen pekar explicit på denna katalog och migrationstabell.

Repo-specifika scripts under `kontakter/scraper/` använder Wrangler för D1-relaterade underhållsoperationer. De ska behandlas som operativa verktyg och inte som alternativa sources of truth.

## Secrets

Wrangler-konfigurationen deklarerar obligatoriska runtime-secrets för bland annat mailkryptering, SMTP och Turnstile. Dokumentation får beskriva secret-namn och ansvar men aldrig värden.

## Observability

Cloudflare observability är aktiverat med query-string-redaction samt begränsad persistent log-/trace-sampling enligt central free-first-policy.

## Uppdateringskontrakt

Uppdatera denna fil när runtime bindings, queue-/rate-limit-modell, D1-schema, authmodell, storage eller deploymentmodell ändras.
