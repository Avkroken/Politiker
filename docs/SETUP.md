# Sätta upp en egen Politikerkontakt

Politikerkontakt använder Cloudflares egna resurser och Wrangler som kontrollplan. Repositoryt innehåller ingen separat provisioneringsmotor. `app/wrangler.jsonc` är source of truth för versionshanterad Worker-konfiguration och `infra/migrations/` är source of truth för D1-schema.

## Förutsättningar

Krav: Git, Node.js 24+, npm och ett Cloudflare-konto med Wrangler åtkomst till de resurser som installationen ska använda.

Klona repositoryt och installera appens beroenden:

```bash
git clone https://github.com/Avkroken/Politiker.git
cd Politiker/app
npm ci
npx wrangler login
```

## Cloudflare-resurser

`app/wrangler.jsonc` deklarerar appens D1-binding, KV, Queues, Durable Object, R2, routes, cron, tail consumer, publika variabler och namn på required secrets. En separat installation ska skapa motsvarande Cloudflare-resurser och ersätta installationsspecifika resurs-ID:n/domäner i sin egen konfiguration. Använd Cloudflares dashboard eller Wrangler direkt; skapa inte ett parallellt repo-lokalt provisioneringslager.

D1 bootstrapas med Wranglers native migrationer:

```bash
cd app
npx wrangler d1 migrations apply politiker-eu --remote
```

`infra/migrations/` är den enda migrationskedjan. Wrangler spårar applicerade migrationer i `d1_migrations`.

## Secrets och variabler

I produktion lagras hemligheter som Cloudflare Worker secrets. Namnen som måste finnas deklareras under `secrets.required` i `app/wrangler.jsonc`. Sätt dem exempelvis med:

```bash
cd app
npx wrangler secret put MAIL_CRED_KEY
npx wrangler secret put SYSTEM_SMTP_PASSWORD
```

Övrig versionshanterad, icke-hemlig konfiguration ligger under `vars` i `wrangler.jsonc`. OAuth client secrets och andra valfria hemligheter ska också lagras som Worker secrets när motsvarande funktion används; de ska aldrig committas.

För lokal utveckling:

```bash
cd app
cp .dev.vars.example .dev.vars
npx wrangler dev --remote
```

Fyll `.dev.vars` endast med lokala secret-värden. Filen är git-ignorerad.

## OAuth

Google, GitHub och Microsoft kan användas för de OAuth-flöden som appen stöder. Registrera callback-URL:erna mot installationens publika basadress:

```text
<APP_BASE_URL>/api/oauth/google/callback
<APP_BASE_URL>/api/oauth/github/callback
<APP_BASE_URL>/api/oauth/microsoft/callback
<APP_BASE_URL>/api/oauth-link/microsoft/callback
<APP_BASE_URL>/api/oauth-mail/microsoft/callback
```

Client ID kan ligga som icke-hemlig Worker-variabel. Client Secret ska vara en Worker secret. Microsoft Graph används även när användaren kopplar Microsoft som sitt eget sändande mailkonto.

## Mail och leveransfel

Systemmail för exempelvis verifiering och lösenordsåterställning använder installationens systemmailkonfiguration. Användarutskick går genom användarens egen mailkoppling, exempelvis SMTP eller Microsoft Graph.

Leveransfel hanteras i Worker/kösystemet och registreras direkt i D1. Det finns ingen separat central Gmail-bounceprocessor eller systemd-tjänst att installera.

## Kontaktdata

En ny D1 innehåller schema men inte automatiskt kontaktdata. Insamling, normalisering och import ligger under `kontakter/`. Den kvartalsvisa helkörningen finns i `kontakter/scraper/quarterly_refresh.sh` och körs separat från Worker-deploy.

## Deploy och verifiering

Validera före deploy:

```bash
cd app
npm run validate
```

Manuell deploy, när den behövs för en separat installation, använder samma native steg som produktionen:

```bash
npm run migrate:production
npm run deploy
npm run verify:production
```

I huvudinstallationen äger Cloudflare Workers Builds produktionsdeploy från `main`; GitHub Actions används för verifiering och deployar inte produktion.

## Felsökning

Kontrollera Cloudflare-session och konfiguration med Wrangler:

```bash
cd app
npx wrangler whoami
npx wrangler deploy --dry-run
```

Skriv aldrig ut eller klistra in `.dev.vars`, Worker secrets, OAuth client secrets, SMTP-lösenord eller tokens i issues eller loggar.
