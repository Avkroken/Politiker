# D1-migrationer

`infra/schema.sql` är den aktuella baslinjen efter squaschen 2026-08-22.

Lägg framtida schemaändringar här som nya numrerade `.sql`-filer. Deploy kör endast filer som inte redan finns i D1-tabellen `schema_migrations`.

Gamla migrationer före baslinjen är avsiktligt borttagna; deras slutliga schema är inbakat i `infra/schema.sql`.
