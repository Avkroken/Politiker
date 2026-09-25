# Drift

## Lokal/full verifiering

Från `app/`:

```bash
npm ci
npm run validate
```

`validate` omfattar:

- enhetstester,
- produktionsverifieringstester,
- syntaxkontroller för frontend-JavaScript,
- lokala D1-migrationer,
- Wrangler type generation,
- TypeScript typecheck,
- Wrangler dry-run.

## Lokal utveckling

```bash
cd app
npm run dev
```

Använd lokal runtime för request- och API-förändringar innan produktion berörs.

## D1-migrationer

Migrationerna ligger i `infra/migrations/`.

Produktionsmigration:

```bash
cd app
npm run migrate:production
```

Före migration:

1. verifiera att migrationen är versionsstyrd;
2. verifiera att aktuell Worker-kod är kompatibel med både före- och efterstate där deploymentordningen kräver det;
3. kör lokal migration genom `npm run validate`.

För migration `0003_generalize_public_contacts.sql` är ordningen **migration först, därefter Worker-deploy**. Migrationen skapar legacy-vyer för `politicians` och `politician_assignments` samt en begränsad kompatibilitetstrigger för leveransverifiering, så den dåvarande Worker-versionen fortsätter fungera under övergången. Kör inte de gamla kontaktunderhållsskripten mellan migrationen och den nya Worker-deployen.

## Queue/DLQ-felsökning

Vid leveransproblem, kontrollera i ordning:

1. persistent send-job-state i D1;
2. queue backlog/retries;
3. dead-letter queue;
4. `CredentialRateLimiter` och credentialgräns;
5. provider/mail-fel.

Manuell återkörning ska inte vara första åtgärd eftersom persistent state och queue-state måste vara konsistenta.

## R2/bilagor

Verifiera binding, objektkey och metadatarelation innan objekt raderas eller skrivs om. Objektinnehåll ska inte användas som generell debugdump.

## Auth/sessionproblem

Kontrollera:

1. request/accessroute;
2. sessionstate i KV;
3. motsvarande account/auth-state i D1;
4. relevant OAuth/TOTP/password-flöde.

Lös inte authfel genom att göra privata routes publika.

## Deployment

```bash
cd app
npm run deploy
```

Vanlig PR-verifiering ska inte implicit deploya.

Efter en avsedd deployment:

```bash
npm run verify:production
```

## Observability

Persistent logs/traces använder sampling och query-string-redaction. Lägg inte credentials, tokens, mailinnehåll eller privata API-payloads i loggar.

## Underhållsscripts

Scripts under `kontakter/scraper/` är operativa verktyg, inte alternativa sources of truth. Verifiera target/config före D1-relaterade operationer och dokumentera nya underhållsflöden här.

`quarterly_refresh.sh` uppdaterar även akademiska yrkeskontakter via `fetch_academics.py`. Akademiregistret använder endast e-postadresser som lärosätena själva publicerar och sparar officiell `source_url` per post. `--dry-run` kan användas för att granska det kurerade akademiurvalet utan D1-skrivningar.
