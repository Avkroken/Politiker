# Sätta upp en egen Politikerkontakt

Målet är att en ny installation ska kräva så få manuella steg som möjligt. Cloudflare-resurser, databas, Worker-secrets, krypteringsnyckel och deploy hanteras av `infra/setup.sh`. Det som inte kan automatiseras utan åtkomst till externa konton samlas i `infra/.env` och kan fyllas via `infra/configure.sh`.

## Snabbstart

Krav: Git, Node.js 24+, npm, Python 3, OpenSSL och ett Cloudflare-konto.

```bash
git clone https://github.com/blixten85/politiker.git
cd politiker
bash infra/configure.sh
bash infra/check-config.sh
bash infra/setup.sh
```

`setup.sh` öppnar Cloudflares webbinloggning via Wrangler om maskinen inte redan är inloggad. Därefter skapas eller återanvänds D1, KV, Queues och R2 automatiskt. En ny D1-databas skapas med EU-jurisdiktion. `MAIL_CRED_KEY` genereras automatiskt och Worker-secrets läggs in med Wrangler.

Om `CUSTOM_DOMAIN` lämnas tom används `https://politiker.workers.dev`. Med egen domän sätts den som Worker custom domain.

## Konfigurationsfilen

`infra/.env.example` är en mall. Den riktiga filen är `infra/.env`, som är git-ignorerad och sätts till filrättighet 600 av setupverktygen. Commit aldrig `infra/.env`.

### Grundkonfiguration

| Variabel | Krävs | Vad den gör | Var den kommer ifrån |
| --- | --- | --- | --- |
| `CUSTOM_DOMAIN` | Nej | Egen publik domän för Worker | En domän du själv kontrollerar i Cloudflare. Lämna tom för workers.dev. |
| `APP_BASE_URL` | Automatisk | Publik bas-URL för callbacks/länkar | Sätts av `setup.sh` från `CUSTOM_DOMAIN` eller Worker-adressen. |
| `MAIL_CRED_KEY` | Ja | Krypterar sparade SMTP-/OAuth-hemligheter och brevdata | Genereras automatiskt med `openssl rand -base64 32`. |
| `SYSTEM_SMTP_HOST` | Ja för kontomail | SMTP-server för verifiering, lösenordsåterställning och systemnotiser | Din e-postleverantörs SMTP-inställningar. |
| `SYSTEM_SMTP_PORT` | Ja | SMTP-port | Vanligen `587` för STARTTLS. |
| `SYSTEM_SMTP_USER` | Ja | SMTP-användarnamn | Vanligen e-postadressen för systemkontot. |
| `SYSTEM_SMTP_PASSWORD` | Ja | SMTP-lösenord/app-lösenord | Skapas hos e-postleverantören. Använd app-lösenord där leverantören stödjer det. |
| `SYSTEM_FROM_ADDRESS` | Ja | Avsändare för systemmail | En adress som SMTP-kontot har rätt att skicka som. |
| `FEEDBACK_NOTIFY_EMAIL` | Ja | Mottagare för feedbacknotiser | Valfri administrativ e-postadress. |

Politikerkontakt kan deployas utan OAuth och bounce-processor. System-SMTP behövs däremot för ett komplett produktionsflöde eftersom nya konton behöver verifieringsmail och lösenordsåterställning.

## OAuth-inloggning — valfritt

Varje provider kräver ett Client ID och ett Client Secret. Client ID är inte hemligt; Client Secret ska ligga i `infra/.env` och skickas av `setup.sh` till Cloudflare som Worker-secret.

### Google

Skapa ett OAuth 2.0 Client ID av typen Web application i Google Cloud Console. Dokumentation: https://developers.google.com/identity/protocols/oauth2/web-server

Använd appens publika basadress och registrera callback:

```text
<APP_BASE_URL>/api/oauth/google/callback
```

Fyll sedan i `OAUTH_GOOGLE_CLIENT_ID` och `OAUTH_GOOGLE_CLIENT_SECRET`.

### GitHub

Skapa en OAuth App under GitHub → Settings → Developer settings → OAuth Apps. Dokumentation: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app

Homepage URL är `APP_BASE_URL` och Authorization callback URL är:

```text
<APP_BASE_URL>/api/oauth/github/callback
```

Fyll i `OAUTH_GITHUB_CLIENT_ID` och `OAUTH_GITHUB_CLIENT_SECRET`.

### Microsoft

Skapa en App registration i Microsoft Entra admin center. Dokumentation: https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app

Lägg till Web redirect URI:er för inloggning/länkning samt Graph-mail om den funktionen ska användas:

```text
<APP_BASE_URL>/api/oauth/microsoft/callback
<APP_BASE_URL>/api/oauth-link/microsoft/callback
<APP_BASE_URL>/api/oauth-mail/microsoft/callback
```

Skapa därefter ett client secret enligt Microsofts dokumentation: https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials

Fyll i `OAUTH_MICROSOFT_CLIENT_ID` och `OAUTH_MICROSOFT_CLIENT_SECRET`.

## Bounce-processor — valfritt

Bounce-processorn läser nya leveransfel från ett Gmail-konto och markerar döda politikeradresser i D1. För den krävs:

- `GMAIL_EMAIL`
- `GMAIL_PASSWORD` — använd ett Gmail app-lösenord om kontot har 2FA. Google: https://support.google.com/accounts/answer/185833
- `CLOUDFLARE_API_TOKEN_POLITIKER` — en Cloudflare API-token med minsta nödvändiga rättighet att skriva till den aktuella D1-databasen.

Vanlig setup/deploy behöver inte denna Cloudflare API-token; Wrangler använder sin egen inloggning. Token behövs endast för lokala hjälpskript som anropar Cloudflares REST-API direkt.

Cloudflare API-token skapas under My Profile → API Tokens. Cloudflares dokumentation: https://developers.cloudflare.com/fundamentals/api/get-started/create-token/

Om bounce-uppgifterna finns installerar `setup.sh` systemd-timern automatiskt på Linux-system med systemd. Annars hoppas hela steget över utan att övrig installation påverkas.

## Azure management-helper — normalt inte nödvändig

Variablerna `AZURE_MGMT_TENANT_ID`, `AZURE_MGMT_CLIENT_ID`, `AZURE_MGMT_CLIENT_SECRET` och `AZURE_POLITIKER_APP_OBJECT_ID` används endast av `infra/az-graph-api.sh`. De behövs inte för att köra Politikerkontakt eller för vanlig Microsoft OAuth. De finns för administrativ automation av en befintlig Azure/Entra-appregistrering.

För en ny installation är rekommendationen att skapa Microsoft App Registration manuellt enligt avsnittet ovan och lämna dessa management-variabler tomma.

## Vad setup.sh automatiserar

`infra/setup.sh` gör följande idempotent så långt leverantörernas CLI tillåter:

1. kontrollerar lokala beroenden,
2. kör den guidade konfigureringen om `infra/.env` saknas,
3. loggar in på Cloudflare via Wrangler,
4. skapar/återanvänder D1, KV, huvudqueue, dead-letter queue och R2,
5. skriver installationens resurs-ID:n och publika variabler till `app/wrangler.jsonc`,
6. installerar npm-beroenden,
7. applicerar schema/migrationer, lägger in Worker-secrets och deployar,
8. installerar bounce-processorn om dess valfria konfiguration finns.

Kör scriptet igen efter konfigurationsändringar; redan existerande Cloudflare-resurser återanvänds.

## Kontaktdata

En helt ny D1 innehåller schema men inga politiker. Insamlings- och importverktygen ligger under `kontakter/`. Den kvartalsvisa helkörningen är `kontakter/scraper/quarterly_refresh.sh`. Den kräver ytterligare scraperberoenden och bör köras separat från själva appdeployen.

För befintlig installation ska migrationer alltid köras via:

```bash
bash infra/apply-migrations.sh
```

## Lokal utveckling

```bash
cd app
npm ci
cp .dev.vars.example .dev.vars
npx wrangler dev --remote
```

`.dev.vars` är också git-ignorerad. Använd separata testuppgifter där det är möjligt.

## Felsökning

Kontrollera först konfigurationen:

```bash
bash infra/check-config.sh
```

Kontrollera därefter Cloudflare-inloggningen:

```bash
npx wrangler whoami
```

Och validera Worker-koden:

```bash
cd app
npm run validate
```

Skriv aldrig ut eller klistra in `infra/.env`, OAuth client secrets, SMTP-lösenord, app-lösenord eller Cloudflare API-token i issues eller loggar.
