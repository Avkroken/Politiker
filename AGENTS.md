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

Arbete sker via tillfälliga arbetsgrenar och pull requests till `main`. Arbetsgrenar får använda repo- eller agentvalda namn som `claude/*`, `codex/*`, `feature/*`, `fix/*` eller motsvarande; de återanvändbara `work/feature`, `work/fix` och `work/chore` får fortfarande användas men är inte obligatoriska.

1. Implementera hela uppgiften och kör relevanta tester/typechecks innan push.
2. Pusha arbetsgrenen och öppna en ready PR till `main`.
3. **Aktivera auto-merge omedelbart.** Required CI och olösta review-trådar är merge-gates.
4. Utvärdera alla review-kommentarer. Relevanta fynd ska fixas innan tråden markeras löst. Lös CI- och reviewproblem i samma branch; PR:n uppdateras av varje push.
5. Efter varje ny commit: kontrollera required checks och review-trådar igen. Merge får inte ske medan required CI är röd/pågående eller en relevant review-tråd är olöst. **Squash merge är den enda tillåtna merge-metoden.**

`.github/workflows/pr-watchdog.yml` bevakar alla lokala branches utom `main`, merge-köns `gh-readonly-queue/*` och uttryckligen konfigurerade permanenta undantag. En branch med unika commits som har saknat öppen PR i mer än 60 minuter får en ready PR till `main` och squash auto-merge armeras. Exakt samma HEAD öppnas inte på nytt om den redan har behandlats i en stängd PR. Watchdoggen avgör inte om arbetet är önskvärt eller mergebart; CI, review och merge-gates gör det.

`.github/workflows/sync-pool.yml` får fortsätta synka de uttryckliga återanvändbara `work/*`-slotsen men får aldrig resetta godtyckliga agent- eller arbetsgrenar.

Skicka aldrig direkt till `main`, kringgå inte branch protection/rulesets, required checks, review resolution eller merge queue och ändra inte hemligheter eller organisationsinställningar utan uttrycklig instruktion.

## Svarsformat

**[SKILLS.md](SKILLS.md) styr allt svarsformat. Läs den och följ den i varje svar.**

SKILLS.md har företräde framför den här filen och framför varje annan formuleringsanvisning i repot. Sammanfatta den inte, återge den inte i kortform och väg den inte mot andra skrivelser — det är den filen som gäller.
