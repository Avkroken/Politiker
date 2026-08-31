# D1-migrationer

`infra/migrations/` är den enda kanoniska migrationskedjan för D1-databasen `politiker-eu`.

- `0000_current_baseline.sql` bootstrapar en tom databas till den aktuella baslinjen.
- Varje framtida schemaändring läggs som en ny, sekventiell `.sql`-fil.
- Lokal verifiering kör `wrangler d1 migrations apply politiker-eu --local`.
- Produktion kör `wrangler d1 migrations apply politiker-eu --remote` via Cloudflare Workers Builds innan Worker-deploy.
- Wrangler äger migrationsstate i `d1_migrations`.

Skapa inte parallella schemafiler, egna migrationsstate-tabeller, shell-baserade migrationsmotorer eller GitHub Actions som muterar produktions-D1.
