# Politikerkontakt

Politikerkontakt är ett gratis och öppet verktyg för att göra det enklare att kontakta folkvalda, även när många mottagare behöver nås samtidigt.

Live: https://politiker.denied.se

Tjänsten låter användaren välja mottagare bland offentligt publicerade kontaktuppgifter, skriva sitt eget brev och skicka det genom ett mailkonto som användaren själv har kopplat. Plattformen producerar eller publicerar inte egna politiska budskap.

## Arkitektur

Produktionen körs på Cloudflare och har en enda tydlig kontrollplan:

- `app/` — huvud-Worker med API, frontend, kökonsument, cron och Durable Object.
- `log-archive/` — Tail Worker som arkiverar Worker-loggar till R2.
- `shared/` — delad TypeScript-kod för bland annat SMTP, Graph, kryptering och validering.
- `kontakter/` — separat insamling och normalisering av offentliga mottagarkontakter.
- `infra/migrations/` — Wranglers native D1-migrationer.

`app/wrangler.jsonc` är source of truth för versionshanterad Worker-konfiguration: bindings, routes, queues, cron, assets, Durable Objects, Tail Worker, publika variabler och namn på obligatoriska secrets. Secret-värden ligger endast i Cloudflare.

Cloudflare D1 är den kanoniska runtime-datakällan. Produktionsdatabasen exporteras inte tillbaka till Git och Git används inte som databasbackup.

## Cloudflare-resurser

Huvud-Workern använder:

- D1 för konto-, brev-, mottagar- och sändningsstate,
- KV för sessioner,
- Queues för sändjobb,
- Durable Objects för delad rate limiting per mailkoppling,
- R2 för temporära bilagor,
- Worker Static Assets för frontend,
- Tail Worker + R2 för loggarkiv.

D1-schema hanteras endast av Wranglers migrationssystem. Nya schemaändringar läggs som nya filer i `infra/migrations/`.

## Mottagardata

Databasen byggs från offentliga källor och omfattar bland annat Europaparlamentet, Riksdagen, regeringen/departement, Sveriges regioner och kommuner, media samt relevanta valda organ inom Svenska kyrkan.

Insamlingsjobben under `kontakter/` är dataproducenter. De får uppdatera kontaktdata med minsta nödvändiga behörighet men äger inte Cloudflare-provisionering, D1-schema eller Worker-deploy.

## Utskick och integritet

Utskick går via användarens egen mailkoppling, exempelvis SMTP eller Microsoft Graph. Cloudflare Queues hanterar jobbet och en Durable Object per mailkoppling håller sändningstakten inom leverantörens gränser. Leveransfel registreras direkt av sändkön i D1.

Tjänsten kräver i grunden endast en e-postadress för konto. Mailcredentials och temporärt brevinnehåll krypteras, temporära bilagor lagras i R2 och brevdata raderas enligt vald retention. Ingen annonserings- eller beteendespårning används.

## Lokal utveckling

Förutsättningar: Node.js enligt `.node-version`, npm och Wrangler-autentisering när fjärrresurser behöver administreras.

```bash
cd app
npm ci
cp .dev.vars.example .dev.vars
npx wrangler d1 migrations apply politiker-eu --local
npm run dev
```

`.dev.vars` innehåller endast lokala secret-värden som deklareras i `wrangler.jsonc`. Icke-hemlig konfiguration kommer från Wrangler-konfigurationen.

Full verifiering före PR:

```bash
cd app
npm run validate
```

Python-delen verifieras separat av repositoryts CI.

## Bidrag och merge-policy

Ändringar görs på kortlivade branches och går via pull request till `main`. Live GitHub-rulesets är verkställande sanning om dokumentation och faktisk enforcement skiljer sig.

För `main` gäller för närvarande:

- `0` formella approvals krävs,
- alla relevanta review-trådar måste vara lösta,
- `CI / required`, `docker` och `scan-pr / osv-scan` måste passera på en branch som är uppdaterad mot senaste `main`,
- CodeQL och Trivy Code Scanning måste uppfylla organisationens aktiva säkerhetströsklar,
- automatiserade reviewfynd är rådgivande men relevanta fynd ska utvärderas och åtgärdas före merge,
- endast squash merge är tillåtet och ruleseten har inga bypass actors.

Kontrollera alltid live-ruleseten och aktuell PR-status före merge; en äldre grön körning räcker inte efter en ny commit eller ändrad base.

## Produktion

Arbete görs på kortlivade branches och går via PR till `main`. GitHub Actions validerar kod och säkerhet men deployar inte produktion.

Cloudflare Workers Builds äger produktionsdeploy från `main`:

| Worker | Root directory | Deploy command |
| --- | --- | --- |
| `politiker` | `app` | `npm run migrate:production && npm run deploy && npm run verify:production` |
| `politiker-log-archive` | `log-archive` | `npm run deploy` |

`npm run migrate:production` kör Wranglers native D1-migrationer direkt mot remote D1 före Worker-deploy. Det finns ingen alternativ repo-lokal deploy- eller migrationsmotor.

Se `docs/CI.md` för CI/deploy-kontraktet och `docs/SETUP.md` för Cloudflare-konfiguration och lokal utveckling.

## Egen installation

Repositoryts `wrangler.jsonc` beskriver Avkrokens produktion och innehåller därför dess icke-hemliga resource IDs och domän. En fork ska skapa egna Cloudflare-resurser och ersätta dessa identifierare i sin Wrangler-konfiguration; kopiera aldrig produktions-secrets eller produktionsdata.

## Säkerhet

Säkerhetskänsliga kontoändringar kräver en färsk session. API-nycklar har begränsade operationer och publika skrivvägar skyddas med rate limiting och andra relevanta kontroller. Säkerhetsbrister rapporteras enligt `SECURITY.md`.
