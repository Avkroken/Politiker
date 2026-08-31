# D1-migrationer

`infra/migrations/` är den kanoniska migrationskedjan för `politiker-eu` och hanteras av Wranglers native D1 migrationssystem.

- `0000_current_baseline.sql` skapar en ny databas i aktuellt schema.
- Senare schemaändringar läggs som nya, sekventiella `.sql`-filer här.
- Produktionsdeploy kör `wrangler d1 migrations apply politiker-eu --remote` före Worker-deploy.
- Wrangler lagrar applicerat state i `d1_migrations`; skapa ingen parallell migrationsstate-tabell.

För den befintliga produktionsdatabasen finns en engångsbrygga i `infra/migrate-d1-native.sh`. Den kör den isolerade historiska kedjan under `infra/legacy-migrations/`, verifierar slutstrukturen, baselinar `d1_migrations` och lämnar därefter över all migrationshantering till Wrangler. Bryggan ska tas bort när den första verifierade native produktionsdeployen har lyckats.

Nya installationer ska aldrig använda `infra/schema.sql` eller legacy-kedjan; de bootstrapas helt från native migrationerna.
