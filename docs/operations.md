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

Normal produktionsexekvering sker manuellt via GitHub Actions-workflown `Deploy Politiker production` (`.github/workflows/deploy-production.yml`). Workflown kan endast köras från `main` och använder organisationens standardiserade deploycredential `CLOUDFLARE_API_TOKEN_W1`.

Körordningen är:

1. installera dependencies och köra `npm run validate`;
2. applicera alla väntande D1-migrationer med `npm run migrate:production`;
3. deploya Workern med `npm run deploy`;
4. generera den kurerade akademisynken som idempotent SQL;
5. applicera akademisynken via Wrangler mot `politiker-eu`;
6. verifiera att minst det kurerade antalet akademikontakter finns över exakt tre kärnområden;
7. verifiera den publika ingressen mot `https://politiker.denied.se/` med `npm run verify:production`.

Akademisynkens SQL-fil innehåller avsiktligt inga explicita `BEGIN`/`COMMIT`/`SAVEPOINT`-satser. Wrangler D1 remote file execution avvisar sådana transaktionskontrollsatser. UPSERT-satserna är idempotenta, så en avbruten eller delvis applicerad synk kan köras om säkert.

Ingresskontrollen är sist med avsikt. Ett Cloudflare-edge-svar får inte hindra redan validerad D1-synk eller göra en lyckad Worker-deploy otydlig. Verifieraren behandlar HTTP 200 som full ingressframgång. En identifierad Cloudflare HTML/challenge-403 från GitHub-runnern rapporteras som en Actions-varning och är inte fatal för deploymenten; andra 4xx/5xx och nätverksfel fortsätter att faila efter retry. Säkra edge-diagnostikheaders som `cf-ray`, `cf-mitigated`, `server` och `content-type` loggas vid blockering, men inga credentials eller privata payloads.

Workflown använder `workflow_dispatch`; push och pull request deployar inte produktion automatiskt. `concurrency` tillåter inte parallella produktionsdeployments.

Direkt lokal exekvering finns kvar för kontrollerad drift:

```bash
cd app
npm run migrate:production
npm run deploy
npm run verify:production
```

Vanlig PR-verifiering ska inte implicit deploya produktion.

### Worker Previews för pull requests

Interna pull requests i `Avkroken/Politiker` får en Cloudflare Worker Preview via `.github/workflows/preview.yml`. Workflown använder organisationens befintliga `CLOUDFLARE_API_TOKEN_W1`; secrets exponeras inte för forkade pull requests.

Previewmiljön är isolerad från produktion och använder gemensamma stagingresurser för alla aktiva PR-previews:

- D1: `politiker-preview-eu` med EU-jurisdiktion;
- KV: `politiker-preview-sessions`;
- R2: `politiker-preview-attachments` med EU-jurisdiktion;
- Queue producer: `politiker-preview-send-jobs`, utan consumer och med kort retention.

Previewmiljön binder avsiktligt inte produktions- eller Preview-Durable Object för `RATE_LIMITER`. Verkliga utskick är redan blockerade i `PREVIEW_MODE`, och web-abuse-rate-limit bypassas endast där. Produktionens Durable Object och rate limiting är oförändrade.

`scripts/prepare-worker-preview.mjs` skapar resurserna idempotent om de saknas och genererar temporära Wrangler-konfigurationer i `app/.wrangler-preview*.json`. Produktions-ID:n kopieras aldrig in i Preview-konfigurationen. D1-migrationerna appliceras på staging-D1 före Preview-deploy och den kurerade akademidatan seedas idempotent så mottagar-UI:t kan granskas.

Previewläge sätter `PREVIEW_MODE=1`. Systemmail undertrycks, verkliga utskick returnerar 409 och previewkonton auto-verifieras lokalt utan Turnstile eller e-post. Detta beteende finns inte i produktionskonfigurationen. OAuth-secrets och produktionsmail-secrets kopieras inte till previews.

När en PR stängs tas själva Worker Previewn bort. De gemensamma stagingresurserna behålls för nästa PR-preview. Preview-URL:n kommenteras på pull requesten.

## Observability

Persistent logs/traces använder sampling och query-string-redaction. Lägg inte credentials, tokens, mailinnehåll eller privata API-payloads i loggar.

## Underhållsscripts

Scripts under `kontakter/scraper/` är operativa verktyg, inte alternativa sources of truth. Verifiera target/config före D1-relaterade operationer och dokumentera nya underhållsflöden här.

`quarterly_refresh.sh` uppdaterar även akademiska yrkeskontakter via `fetch_academics.py`. Akademiregistret använder endast e-postadresser som lärosätena själva publicerar och sparar officiell `source_url` per post. `--dry-run` kan användas för att granska det kurerade akademiurvalet utan D1-skrivningar.
