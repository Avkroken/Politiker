# politiker — AI Agent Guide

Webbtjänst där användare kopplar sitt eget mailkonto och skickar personaliserade brev till folkvalda. Repot innehåller både Cloudflare-tjänsten och kontaktkedjan som fyller samma D1.

## Struktur och teknik

- `app/` — Cloudflare Worker med `fetch`, `queue` och `scheduled`.
- `log-archive/` — tail-konsument som arkiverar `app/`:s loggevent till R2. Kopplas in via `tail_consumers` i `app/wrangler.jsonc`.
- `shared/` — delad validering, kryptering, SMTP och typer.
- `infra/` — Cloudflare-provisionering och schema.
- `kontakter/` — Python-skrapning, export och verifiering av kontaktdata.
- D1, KV, Queues och Durable Objects används i produktion.

## Säkerhetskonventioner

- Hemligheter sätts via Cloudflare/GitHub secrets och får aldrig hårdkodas eller loggas.
- Alla kontoägda databasfrågor ska filtrera på `account_id`; admin-endpoints kräver uttrycklig adminbehörighet.
- `MAIL_CRED_KEY`, SMTP-lösenord, TOTP-secrets och sessionstokens är känsliga.
- PBKDF2 ska hålla sig inom Workers runtime-begränsningar; ändra inte säkerhetsparametrar utan verifiering.
- Föredra minsta nödvändiga behörighet och befintliga standardmekanismer framför nya wrappers eller specialflöden.
- GitHub Actions pinnas till commit-SHA när praktiskt möjligt.

## GitHub-arbetsflöde

`dev` är den enda skrivbara grenen. `main` tar bara emot squash-mergade PR:er
som passerat gröna checkar.

**Skapa aldrig egna grenar.** Allt arbete sker på `dev`. Det är en hård regel, inte
en rekommendation: grenar som skapas per uppgift blir liggande halvfärdiga, och det
är hela anledningen till att modellen ser ut så här.

1. Utgå från aktuell `dev`. Ligger det osynkat arbete där, bygg vidare på det i
   stället för att börja om någon annanstans.
2. Implementera hela uppgiften och kör relevanta tester/typechecks innan push.
3. Pusha till `dev` och öppna PR från `dev` till `main` som klar för granskning.
   Aktivera auto-merge — merge-kön tar PR:n så snart required checks är gröna.
4. Lös CI- och reviewproblem på `dev`; PR:n uppdateras automatiskt av varje push.
5. **Squash merge är den enda tillåtna merge-metoden.** Efter merge återställs `dev` till
   `main` automatiskt av `.github/workflows/sync-dev.yml`.

Skicka aldrig direkt till `main`, kringgå inte branch protection/rulesets och ändra
inte hemligheter eller organisationsinställningar utan uttrycklig instruktion.

## Svarsformat

**[SKILLS.md](SKILLS.md) styr allt svarsformat. Läs den och följ den i varje svar.**

SKILLS.md har företräde framför den här filen och framför varje annan
formuleringsanvisning i repot. Sammanfatta den inte, återge den inte i kortform
och väg den inte mot andra skrivelser — det är den filen som gäller.
