# AGENTS.md

Den här filen är repositoryts auktoritativa arbetsinstruktion. Live GitHub-konfiguration är verkställande sanning när dokumentation och faktisk enforcement skiljer sig.

## Repository

`politiker` är en webbtjänst där användare kopplar sitt eget mailkonto och skickar personaliserade brev till folkvalda.

- `app/` — Cloudflare Worker med `fetch`, `queue` och `scheduled`.
- `log-archive/` — tail-konsument som arkiverar `app/`:s loggevent till R2.
- `shared/` — delad validering, kryptering, SMTP och typer.
- `infra/` — Cloudflare-provisionering och schema.
- `kontakter/` — Python-skrapning, export och verifiering av kontaktdata.
- D1, KV, Queues och Durable Objects används i produktion.

## Brancher och pull requests

- Pusha aldrig direkt till `main`.
- Använd en kortlivad branch och öppna en ready PR till `main`.
- **Aktivera auto-merge omedelbart när PR:n skapats**, även medan CI eller review pågår.
- Använd inte direkt merge om det inte uttryckligen begärts.
- Live-rulesetet tillåter för närvarande endast squash merge.
- Repositoryt använder inte merge queue och har ingen obligatorisk återanvändbar branchpool.
- Codex-remediation använder körningsunika branches under `automation/codex-issue/`.

## Merge-gates

För `main` gäller för närvarande:

- required status check: `typecheck`
- required status check: `python`
- olösta review-trådar blockerar merge
- Copilot Code Review körs vid push till PR-grenen
- squash är enda tillåtna merge-metod

Alla review-kommentarer och trådar ska läsas och utvärderas. Relevanta findings åtgärdas i samma PR. En tråd markeras resolved först när eventuell nödvändig fix är pushad och verifierad.

Efter varje ny commit ska relevant CI och review-status kontrolleras igen. När required checks är gröna och alla relevanta review-trådar är resolved ska den redan armerade auto-merge-funktionen föra PR:n till `main`.

Om auto-merge inte sker ska den konkreta blockeraren i live-ruleset, review-state eller repositoryinställning identifieras. Kringgå aldrig repositoryskydd.

## Säkerhet

- Hemligheter sätts via Cloudflare/GitHub secrets och får aldrig hårdkodas eller loggas.
- Alla kontoägda databasfrågor ska filtrera på `account_id`; admin-endpoints kräver uttrycklig adminbehörighet.
- `MAIL_CRED_KEY`, SMTP-lösenord, TOTP-secrets och sessionstokens är känsliga.
- PBKDF2 ska hålla sig inom Workers runtime-begränsningar; ändra inte säkerhetsparametrar utan verifiering.
- Föredra minsta nödvändiga behörighet och befintliga standardmekanismer framför nya wrappers eller specialflöden.
- GitHub Actions ska pinnas till commit-SHA när praktiskt möjligt.

## GitHub Actions och Cloudflare

- `.github/workflows/ci.yml` producerar required contexts `typecheck` och `python`.
- Required `typecheck` blockerar alla PR:er som fortfarande innehåller `.github/codex-dispatch/issue-*.md`; en remediation-seed får aldrig nå `main`.
- Required `typecheck` ska validera både `app` och `log-archive`: appens fulla `npm run validate` samt Wrangler dry-run av tail-konsumenten.
- `.github/workflows/osv-scanner.yml` och `.github/workflows/docker.yml` är kompletterande säkerhetsverifiering och är inte required contexts i nuvarande ruleset.
- `.github/workflows/codex-issue-remediation.yml` skapar en körningsunik remediation-branch, öppnar PR och armerar auto-merge direkt.
- `.github/workflows/auto-fix-review.yml` får begära Codex-fix för uttryckligen betrodd review-feedback men får inte lösa review-tråden åt implementationen.
- Cloudflare Workers Builds äger normal produktionsdeploy från `main`; GitHub Actions ska inte deploya produktion.
- `app` och `log-archive` ska använda `npm run deploy:production` som Workers Builds deploy command.
- `scripts/deploy-production.mjs` failar stängt på fel Workers Builds-branch eller ogiltig build-SHA, deployar med `wrangler deploy --strict` och märker deploymenten med Git-SHA.
- App-Workern är ensam D1-migrationsägare och ska köra `infra/apply-migrations.sh` före production deploy. `log-archive` använder inte D1 och får inte köra dessa migrationer.
- Efter app-deploy måste huvuddomänen svara HTTP 200. `log-archive` är bara tail-konsument och ska inte exponeras publikt för health-check.
- Workers Builds watch paths ska omfatta respektive Worker-root och `scripts/**`; appen ska dessutom bevaka relevant `shared/**` och `infra/migrations/**`.
- `wrangler.jsonc` är source of truth för Worker-bindings, routes, queues, cron, tail consumers och övrig versionshanterad Worker-konfiguration.

## Verifiering

Granska hela diffen mot `main` före PR. Kör eller verifiera relevanta tester, typecheck, Python-CI och säkerhetsjobb efter varje push. Kontrollera att inga secrets, credentials, debugrester eller oavsiktliga genererade filer har lagts till.

När ändringen påverkar Cloudflare runtime, bindings, secrets, routes, queues eller annan live-konfiguration ska den deployade konfigurationen verifieras efter ändringen.

## Svarsformat

**[SKILLS.md](SKILLS.md) styr allt svarsformat. Läs den och följ den i varje svar.**

## Definition of done

En PR-baserad uppgift är klar först när implementationen är färdig, diffen självgranskad, all review-feedback utvärderad, required `typecheck` och `python` är gröna, relevanta review-trådar är resolved och auto-merge har mergat PR:n eller är armerad medan en verifierad extern gate fortfarande väntar.
