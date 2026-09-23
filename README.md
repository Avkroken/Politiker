# Politiker

Politiker är en Cloudflare-baserad webbapplikation för kontaktdata, konton, utskick och relaterad administration. Repositoryt innehåller både applikationsruntime och stöd för att underhålla den data som applikationen använder.

## Runtime

Produktionsappen körs som Worker `politiker` på `politiker.denied.se` och använder bland annat:

- D1-databasen `politiker-eu`,
- KV för sessionsstate,
- Queue `politiker-send-jobs` för utskick,
- Durable Object `CredentialRateLimiter` för serialiserad rate limiting,
- R2 `politiker-attachments` för bilagor,
- Cloudflare Email Service-binding,
- schemalagd körning för att fortsätta väntande utskicksjobb.

## Dokumentation

- [Projektkontext](docs/project-context.md)
- [Arkitektur](docs/architecture.md)
- [Drift](docs/operations.md)
- [Avkrokens dokumentationsstandard](https://github.com/Avkroken/.github/blob/main/docs/documentation-standard.md)

## Verifiering

Från `app/`:

```bash
npm ci
npm run validate
```

`validate` kör tester, produktionsverifieringstester, JavaScript-syntaxkontroller, lokala D1-migrationer, Wrangler types, TypeScript typecheck och Wrangler dry-run.

## Säkerhet

Secrets, SMTP-credentials, OAuth-client secrets och andra känsliga värden hör hemma i runtimekonfiguration och får inte committas. Rapportera sårbarheter privat enligt [SECURITY.md](SECURITY.md).
