# Drift

## Full repositoryverifiering för appen

```bash
cd app
npm ci
npm run validate
```

Verifieringen omfattar tester, lokala D1-migrationer, type generation/typecheck, syntaxkontroller och Wrangler dry-run.

## D1

Migrationer ligger i `infra/migrations/`. Produktionsmigrationer ska appliceras med repositoryts avsedda Wrangler-konfiguration; gör inte ad hoc-schemaändringar direkt i produktion som saknar versionerad migration.

## Queue

Vid leveransproblem kontrollera:

1. persistent send-job-state i D1,
2. queue retries/backlog,
3. dead-letter queue,
4. rate-limiter-state/credentialgräns,
5. först därefter eventuell manuell återkörning.

## Credentials

Secret-värden får aldrig läggas i Git, issues, logs eller dokumentation. Behåll separata secrets för separata trust boundaries.

## Observability

Wrangler-konfigurationen redigerar query strings från persistent observability. Den inställningen ska inte tas bort eftersom auth-/API-flöden kan bära känsliga parametrar.

## Deployment

Repositoryt har explicita deploy- och produktionsmigrationsscripts i `app/package.json`. Vanlig dokumentations- eller PR-verifiering ska stanna vid test/typecheck/dry-run och inte implicit deploya produktion.

## Scraper/underhåll

Scripts under `kontakter/scraper/` som arbetar mot D1 ska köras med verifierad target/config och utan nya separata credentials när befintlig Wrangler-inloggning är den avsedda vägen.
