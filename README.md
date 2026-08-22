# Politikerkontakt

Politikerkontakt är ett gratis och öppet verktyg för att göra det enklare för människor att kontakta sina folkvalda, även när många mottagare behöver nås samtidigt.

Live: https://politiker.denied.se

Projektets grundprincip är enkel: politiker och andra offentliga aktörer har många kanaler för att nå befolkningen. Politikerkontakt ger människor en praktisk kanal i motsatt riktning. Plattformen är infrastruktur för användarens kommunikation och tar inte själv politisk ställning.

## Vad tjänsten gör

- Låter användaren välja mottagare bland offentligt publicerade politiska kontaktuppgifter.
- Låter användaren skriva sitt eget brev eller frivilligt använda AI som skrivhjälp.
- Ett AI-utkast granskas och redigeras av användaren och skickas aldrig automatiskt.
- Skickar användarens brev genom ett e-postkonto som användaren själv har kopplat.
- Hanterar stora utskick med kö, dygnstak, leverantörsgränser och studs-/felhantering.
- Ger användaren historik och status för sina egna utskick.
- Har konto, OAuth, TOTP 2FA, API-nycklar, kontakt/feedback och administrativ statistik.

Politikerkontakt producerar, publicerar eller skickar **inte egna politiska brev eller ställningstaganden** och är inte en redaktion.

## Mottagare

Databasen byggs från offentliga källor och omfattar bland annat Europaparlamentet, Riksdagen, regeringen/departement, Sveriges 21 regioner, Sveriges 290 kommuner och relevanta valda organ inom Svenska kyrkan. Insamlings- och uppdateringslogiken finns i `kontakter/`.

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
- Cloudflare D1 används som databas och R2 för temporära bilagor.

Officiell GDPR-dokumentation: https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/introduktion-till-gdpr/dataskyddsforordningen-i-fulltext/ och https://eur-lex.europa.eu/eli/reg/2016/679/oj

## AI-skrivhjälp

AI är en valfri hjälp för **användarens eget brev**. Plattformen använder inte AI för att själv välja politiska frågor, skapa kampanjer eller skicka egna ställningstaganden. Användaren ansvarar för att läsa och godkänna sitt utkast före utskick. Text som skickas till en vald AI-leverantör behandlas även av den leverantören enligt dess villkor.

## Utskick

Utskick går via användarens egen mailkoppling, exempelvis SMTP eller Microsoft Graph. `noreply@denied.se` används endast för tekniska systemmail som verifiering och lösenordsåterställning. `politiker@denied.se` är projektets kontaktadress.

Kösystemet använder Cloudflare Queues och D1. En Durable Object per mailkoppling upprätthåller delad sändningstakt mellan parallella jobb och skyddar mot att leverantörens gränser överskrids.

## Repots struktur

| Katalog | Innehåll |
| --- | --- |
| `app/` | Cloudflare Worker, API och frontend |
| `shared/` | Delad TypeScript-kod, bland annat SMTP, kryptering och typer |
| `kontakter/` | Insamling och uppdatering av offentliga kontaktuppgifter |
| `infra/` | D1-schema, migrationer och provisioneringsverktyg |

Viktiga delar i `app/src/` är `send-queue.ts` för faktisk sändning, `rate-limiter.ts` för sändningstakt, `letter-privacy.ts` för skydd/retention, `draft-letter.ts` för frivillig AI-skrivhjälp och auth/OAuth-modulerna för kontoåtkomst.

## Köra en egen kopia

Förutsättningar: Cloudflare-konto och Node.js 18+.

```bash
git clone https://github.com/blixten85/politiker.git
cd politiker
bash infra/setup.sh
```

För lokal utveckling:

```bash
cd app
npm install
cp .dev.vars.example .dev.vars
npx wrangler dev --remote
```

Validering före deploy:

```bash
cd app
npm run validate
```

## Säkerhet

SMTP-/mailhemligheter och temporärt brevinnehåll skyddas med applikationskryptering. Säkerhetskänsliga kontoändringar kräver en färsk webbsession, API-nycklar har begränsade operationer och publika skrivvägar skyddas med bland annat Turnstile/rate limiting där det behövs.

## Sponsring

Politikerkontakt är gratis att använda. Frivilligt stöd till drift och fortsatt utveckling kan lämnas via:

- GitHub Sponsors: https://github.com/sponsors/blixten85
- PayPal: https://paypal.me/anders0225

Även en liten summa, exempelvis 25 kr, är tillräcklig; PayPal-länken låter givaren välja belopp själv.

## Kontakt och källkod

Källkoden finns öppet i detta GitHub-repo. Frågor om tjänsten kan skickas till `politiker@denied.se` eller via tjänstens kontaktfunktion.
