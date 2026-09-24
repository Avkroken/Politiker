# Politiker

Politiker är en Cloudflare-baserad webbapplikation för konton, kontakt-/mottagardata, brev och utskick. Repositoryt innehåller både applikationsruntime och verktyg för att underhålla dess data.

## Snabb verifiering

Från `app/`:

```bash
npm ci
npm run validate
```

`validate` kör tester, produktionsverifieringstester, JavaScript-kontroller, lokala D1-migrationer, Wrangler types, TypeScript typecheck och Worker dry-run.

## Dokumentation

Börja i **[dokumentationsöversikten](docs/index.md)**.

- [Projektkontext](docs/project-context.md) — runtime, state och subsystem
- [Arkitektur](docs/architecture.md) — request-, auth-, lagrings- och utskicksflöden
- [Drift](docs/operations.md) — verifiering, migrationer, queue/DLQ och deployment
- [SECURITY.md](SECURITY.md) — säkerhetsrapportering

README hålls medvetet kort. Detaljerad teknisk dokumentation ligger under `docs/`.

## Runtime i korthet

Applikationen använder D1, KV, Queue + DLQ, Durable Object, R2, Cloudflare Email och schemalagd Worker-körning. Dessa lager har olika ansvar och ska inte behandlas som utbytbara state stores.
