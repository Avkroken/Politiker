# Politikerkontakt

Politikerkontakt är ett gratis och öppet verktyg för att göra det enklare för människor att kontakta sina folkvalda, även när många mottagare behöver nås samtidigt.

Live: https://politiker.denied.se

Projektets grundprincip är enkel: folkvalda har många kanaler för att nå befolkningen. Politikerkontakt ger människor en praktisk kanal i motsatt riktning. Plattformen är infrastruktur för användarens kommunikation och tar inte själv politisk ställning.

## Vad tjänsten gör

- Låter användaren välja mottagare bland offentligt publicerade politiska kontaktuppgifter.
- Låter användaren skriva och redigera sitt eget brev.
- Skickar användarens brev genom ett e-postkonto som användaren själv har kopplat.
- Hanterar stora utskick med kö, dygnstak, leverantörsgränser och studs-/felhantering.
- Ger användaren historik och status för sina egna utskick.
- Har konto, OAuth, TOTP 2FA, API-nycklar, kontakt/feedback och administrativ statistik.

Politikerkontakt producerar, publicerar eller skickar **inte egna politiska brev eller ställningstaganden** och är inte en redaktion.

## Mottagare

Databasen byggs från offentliga källor och omfattar bland annat Europaparlamentet, Riksdagen, regeringen/departement, Sveriges regioner och kommuner samt relevanta valda organ inom Svenska kyrkan. Insamlings- och uppdateringslogiken finns i `kontakter/`.

Importerade parti- och befattningsuppgifter normaliseras innan de används för mottagarfiltrering. Syftet är att hålla filtren inriktade på relevanta politiska mottagare även när källorna använder varierande benämningar eller innehåller administrativa uppdrag.

## Integritet och dataminimering

Tjänsten är byggd för att behandla så lite användardata som möjligt.

- Ett konto kräver i grunden en e-postadress; den kan vara separat från det mailkonto som används för utskick.
- Tjänsten kräver inte användarens namn, personnummer, bostadsadress eller telefonnummer.
- IP-adresser används inte för användarprofiler eller beteendespårning.
- Ingen annonserings- eller beteendespårning används.
- Anslutningsuppgifter för mail skyddas med applikationskryptering.
- Brevinnehåll lagras krypterat medan det behövs för utskicket.
- Kortast retention är standard för privata brev; användaren kan välja en begränsad längre retention.
- Brevtext och temporära bilagor raderas efter retentionstiden. Minimal metadata om status, antal skickade/studsade meddelanden och tidpunkter kan behållas för historik, statistik och drift.
- Cloudflare D1 används som databas med EU-jurisdiktion och R2 används för temporära bilagor.

## Utskick

Utskick går via användarens egen mailkoppling, exempelvis SMTP eller Microsoft Graph. `noreply@denied.se` används endast för tekniska systemmail som verifiering och lösenordsåterställning. `politiker@denied.se` är projektets kontaktadress.

Kösystemet använder Cloudflare Queues och D1. En Durable Object per mailkoppling upprätthåller delad sändningstakt mellan parallella jobb och skyddar mot att leverantörens gränser överskrids.

## Repots struktur

| Katalog | Innehåll |
| --- | --- |
| `app/` | Cloudflare Worker, API, kökonsument, retention och frontend |
| `shared/` | Delad TypeScript-kod, bland annat SMTP, kryptering och typer |
| `kontakter/` | Insamling, normalisering och uppdatering av offentliga kontaktuppgifter |
| `infra/` | D1-schema, databasbootstrap och provisioneringsverktyg |

Viktiga delar i `app/src/` är `send-queue.ts` för faktisk sändning, `rate-limiter.ts` för sändningstakt, `letter-privacy.ts` för skydd/retention och auth/OAuth-modulerna för kontoåtkomst.

## Köra en egen kopia

Förutsättningar: Cloudflare-konto och Node.js 24.

```bash
git clone https://github.com/blixten85/politiker.git
cd politiker
bash infra/setup.sh
```

För lokal utveckling:

```bash
cd app
npm ci
cp .dev.vars.example .dev.vars
npx wrangler dev --remote
```

Validering före deploy:

```bash
cd app
npm run validate
```

## CI, deploy och release

Arbete går via `dev` → PR → `main`. GitHub Actions kör projektets CI-kontroller. Produktion deployas av Cloudflare från `main`, så kod på `dev` deployas inte till produktion. Databasschema och bootstrap hanteras separat från den automatiska Worker-deployen. GitHub Releases versionssätts automatiskt från commitmeddelanden; se `docs/CI.md` för reglerna.

## Säkerhet

SMTP-/mailhemligheter och temporärt brevinnehåll skyddas med applikationskryptering. Säkerhetskänsliga kontoändringar kräver en färsk webbsession, API-nycklar har begränsade operationer och publika skrivvägar skyddas med bland annat Turnstile/rate limiting där det behövs. Säkerhetsbrister rapporteras enligt `SECURITY.md`.

## Kontakt och källkod

Källkoden finns öppet i detta GitHub-repo. Frågor om tjänsten kan skickas till `politiker@denied.se` eller via tjänstens kontaktfunktion.
