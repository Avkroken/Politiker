# politiker — AI Agent Guide

Webbtjänst där användare kopplar sitt eget mailkonto och skickar personaliserade brev till folkvalda. Repot innehåller både Cloudflare-tjänsten och kontaktkedjan som fyller samma D1.

## Struktur och teknik

- `app/` — Cloudflare Worker med `fetch`, `queue` och `scheduled`.
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

`main` är den enda långlivade arbetsgrenen. `dev` används inte.

1. Skapa en ny kortlivad branch från aktuell `main` för varje uppgift.
2. Implementera hela uppgiften och kör relevanta tester/typechecks innan push.
3. Öppna PR från arbetsbranchen till `main` som klar för granskning. Aktivera inte auto-merge.
4. Lös CI- och reviewproblem på samma arbetsbranch. Required checks och review-trådar ska vara klara före merge.
5. Merge sker med **squash merge**. Använd inte merge commits eller rebase merge. Head-branchen får raderas efter merge.

Skicka aldrig direkt till `main`, force-pusha inte förbi skydd och kringgå inte branch protection/rulesets. Ändra inte hemligheter eller organisationsinställningar utan uttrycklig instruktion.

## Svarsformat

Led med nästa åtgärd eller resultat. Numrera flerstegsarbete, håll listor korta och ange konkret orsak/fix vid fel.
