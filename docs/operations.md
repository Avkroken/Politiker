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

För migration `0003_generalize_public_contacts.sql` var ordningen **migration först, därefter Worker-deploy**. Den skapade legacy-vyer för `politicians` och `politician_assignments` samt en begränsad compatibility-trigger för cutover. Current Worker och kontaktverktyg använder nu canonical `public_contacts` / `public_contact_assignments`. Migration `0005_drop_public_contact_legacy_views.sql` tar därför bort endast de tre temporära D1-objekten. Verifiera före production migration att current Worker-versionen är deployad och efter migration att canonical tabellerna finns kvar samt att legacyobjekten saknas.

## Queue/DLQ-felsökning

Vid leveransproblem, kontrollera i ordning:

1. persistent send-job-state i D1;
2. queue backlog/retries;
3. dead-letter queue;
4. `CredentialRateLimiter` och credentialgräns;
5. provider/mail-fel.

Manuell återkörning ska inte vara första åtgärd eftersom persistent state och queue-state måste vara konsistenta.

### SMTP-credential och autentiseringsfel

Felsök ett lagrat SMTP-konto i den här ordningen:

1. **Fresh session:** känsliga credential-operationer kräver en autentisering som är högst 15 minuter gammal. UI:t öppnar automatiskt **Bekräfta att det är du** och förnyar den befintliga webbsessionen efter lösenord/2FA-verifiering; användaren ska inte behöva logga ut. OAuth-only-konton skickas genom sitt länkade externa inloggningssätt utan föregående logout. SMTP-anropet startar först efter lyckad återautentisering.
2. **Dekryptering:** `Det sparade SMTP-lösenordet kan inte dekrypteras` betyder att den lagrade credentialen inte kan läsas med aktuell `MAIL_CRED_KEY`. Rotera inte `MAIL_CRED_KEY` som felsökningsåtgärd; använd **Uppdatera lösenord** för att testa och kryptera credentialen på nytt.
3. **SMTP-auth:** ett explicit providerfel som `535` betyder att SMTP-servern avvisade credentialen. För iCloud används `smtp.mail.me.com:587` med STARTTLS och ett appspecifikt lösenord.
4. **Leverans:** först när credentialen autentiserar ska D1 send-job-state, Queue/DLQ och mottagarspecifika SMTP-svar felsökas.

**Uppdatera lösenord** autentiserar det inmatade värdet mot den befintliga SMTP-host/user/from-konfigurationen innan `encrypted_password` och `verified_at` skrivs. Ett misslyckat test ändrar alltså inte den lagrade credentialen.

## R2/bilagor

Verifiera binding, objektkey och metadatarelation innan objekt raderas eller skrivs om. Objektinnehåll ska inte användas som generell debugdump.

## Auth/sessionproblem

Kontrollera:

1. request/accessroute;
2. sessionstate i KV;
3. motsvarande account/auth-state i D1;
4. relevant OAuth/TOTP/password-flöde.

Lös inte authfel genom att göra privata routes publika.

## Releasegräns

Release- och versionskontraktet finns i [release-standard.md](release-standard.md).

Politiker har ingen canonical lokal produktversionsfil på current `main`. `app/package.json` är privat och saknar `version`. Inför därför inte package-version eller `version.txt` enbart för releaseautomation.

Versionerade releases förankras i SemVer-taggar och GitHub Releases. De är separata från produktionsdeployment:

- tagg/GitHub Release deployar inte produktion i sig;
- produktion deployas av Cloudflare Workers Builds när `main` uppdateras;
- releaseautomation får inte skapa en separat deployväg eller egna Cloudflare-credentials i GitHub.

Före en release ska normal CI vara grön. För appdelen ska minst:

```bash
cd app
npm ci
npm run validate
```

vara verifierat.

Current releaseflöde är repo-lokalt i `.github/workflows/release.yml`: efter merge till `main` väntar releasen på de checks som anges i `.github/release-required-checks` och skapar därefter SemVer-tagg/GitHub Release när historiken innehåller en releasevärdig förändring. Canonical releasepublication använder ingen PAT eller bredare App-writebehörighet; den valfria rådgivande Copilot-sammanfattningen använder separat read-only `COPILOT_GITHUB_TOKEN` och ändrar inte release-body:n.

## Deployment

Cloudflare Workers Builds äger produktionsdeployment och Worker Previews. GitHub Actions används endast för repository-CI och behöver inga användarkonfigurerade Cloudflare-secrets. GitHubs automatiska `GITHUB_TOKEN` används fortsatt där GitHub-native workflows behöver den.

Verifierad repository-konfiguration för Workers Builds:

- root directory: `/app`;
- production branch: `main`;
- production deploy command: `npm run deploy:workers-builds`;
- preview builds: aktiverade för icke-produktionsgrenar;
- preview command: `npm run preview:workers-builds`.

Workers Builds lagrar och använder sin build/deploy-token på Cloudflare-sidan. Repositoryt lagrar inte tokenvärdet. Eftersom produktions- och preview-kommandona även kör D1 remote migrations/sync måste den Cloudflare-valda build-tokenen ha D1-behörighet utöver de vanliga Worker-deploybehörigheterna.

`scripts/workers-build-production.mjs` vägrar köra utanför Workers Builds och vägrar deploy om `WORKERS_CI_BRANCH` inte är `main`. Körordningen är:

1. `npm run validate`;
2. applicera väntande D1-migrationer via `npm run migrate:production`;
3. deploya Workern via `npm run deploy`;
4. generera den kurerade akademisynken som idempotent SQL;
5. applicera akademisynken via Wrangler mot `politiker-eu`;
6. verifiera att minst det kurerade antalet akademikontakter finns över exakt tre kärnområden;
7. verifiera den publika ingressen via `npm run verify:production`.

Akademisynkens SQL-fil innehåller avsiktligt inga explicita `BEGIN`/`COMMIT`/`SAVEPOINT`-satser. Wrangler D1 remote file execution avvisar sådana transaktionskontrollsatser. UPSERT-satserna är idempotenta, så en avbruten eller delvis applicerad synk kan köras om säkert.

Ingresskontrollen är sist med avsikt. Ett Cloudflare-edge-svar får inte hindra redan validerad D1-synk eller göra en lyckad Worker-deploy otydlig. Verifieraren behandlar HTTP 200 som full ingressframgång. En identifierad Cloudflare HTML/challenge-403 från buildmiljön rapporteras som en varning och är inte fatal för deploymenten; andra 4xx/5xx och nätverksfel fortsätter att faila efter retry. Säkra edge-diagnostikheaders som `cf-ray`, `cf-mitigated`, `server` och `content-type` loggas vid blockering, men inga credentials eller privata payloads.

Direkt lokal exekvering finns kvar för kontrollerad drift när operatören redan har lokal Cloudflare-autentisering:

```bash
cd app
npm run migrate:production
npm run deploy
npm run verify:production
```

Vanlig GitHub CI deployar aldrig produktion.

### Worker Previews för pull requests

Cloudflare Workers Builds skapar branchbaserade Worker Previews för icke-`main`-grenar och kommenterar Preview-URL på tillhörande pull request. Repositoryt har ingen separat GitHub Actions-workflow för Preview och behöver därför ingen Cloudflare-secret i GitHub.

Previewmiljön använder de redan etablerade stagingresurserna som deklareras statiskt i `app/wrangler.jsonc` under `previews`:

- D1: `politiker-preview-eu` med EU-jurisdiktion;
- KV: `politiker-preview-sessions`;
- R2: `politiker-preview-attachments` med EU-jurisdiktion;
- Queue producer: `politiker-preview-send-jobs`, utan consumer.

Previewmiljön binder avsiktligt inte produktions- eller Preview-Durable Object för `RATE_LIMITER`, inga produktionsroutes, crontriggers eller e-postbindingar. Verkliga utskick är blockerade i `PREVIEW_MODE`, och web-abuse-rate-limit bypassas endast där. Produktionens Durable Object och rate limiting är oförändrade.

`app/wrangler.preview-migrations.jsonc` pekar D1-migrationerna på samma fysiska preview-D1 som `previews.d1_databases`. `scripts/workers-build-preview.mjs` kör validering, preview-migrationer och idempotent akademiseed innan `wrangler preview`. Previewläge sätter `PREVIEW_MODE=1`; systemmail undertrycks, verkliga utskick returnerar 409 och previewkonton auto-verifieras lokalt utan Turnstile eller e-post.

Cloudflare äger Preview-record och Preview-URL. Repositoryt kör inte längre en credential-bärande cleanup-workflow när en PR stängs. Gamla previews kan tas bort operativt från Cloudflare eller evikteras automatiskt när Cloudflares Preview-gräns nås.

## Observability

Persistent logs/traces använder sampling och query-string-redaction. Lägg inte credentials, tokens, mailinnehåll eller privata API-payloads i loggar.

## Underhållsscripts

Scripts under `kontakter/scraper/` är operativa verktyg, inte alternativa sources of truth. Verifiera target/config före D1-relaterade operationer och dokumentera nya underhållsflöden här.

`quarterly_refresh.sh` uppdaterar även akademiska yrkeskontakter via `fetch_academics.py`. Akademiregistret använder endast e-postadresser som lärosätena själva publicerar och sparar officiell `source_url` per post. `--dry-run` kan användas för att granska det kurerade akademiurvalet utan D1-skrivningar.
