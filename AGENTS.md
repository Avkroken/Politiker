# AGENTS.md

Den här filen är repositoryts auktoritativa arbetsinstruktion. Live GitHub-konfiguration är verkställande sanning när dokumentation och faktisk enforcement skiljer sig.

## Repository

`politiker` är en webbtjänst där användare kopplar sitt eget mailkonto och skickar personaliserade brev till folkvalda.

- `app/` — Cloudflare Worker med `fetch`, `queue` och `scheduled`.
- `log-archive/` — Tail Worker som arkiverar `app/`:s loggevent till R2.
- `shared/` — delad validering, kryptering, SMTP, Graph och typer.
- `infra/migrations/` — Wranglers native D1-migrationer.
- `kontakter/` — separat Python-insamling, normalisering och verifiering av kontaktdata.

Cloudflare D1 är kanonisk runtime-datakälla. Git får inte användas som produktionsdatabas, D1-snapshot eller alternativ Cloudflare-kontrollplan.

## Brancher och pull requests

- Pusha aldrig direkt till `main`.
- Använd en kortlivad branch och öppna en ready PR till `main`.
- Aktivera auto-merge först när live-rulesetet är verifierat fail-closed för den aktuella mergepolicyn.
- Använd inte direkt merge om det inte uttryckligen begärts.
- Endast squash merge är tillåtet.

## Merge-gates

Live-konfigurationen är sanningskällan. För `main` gäller bland annat:

- required `CI / required`, `docker` och `scan-pr / osv-scan`
- strict latest-base-verifiering
- en approval krävs; stale reviews avvisas efter push och den senaste pushen måste godkännas av någon annan
- olösta review-trådar blockerar merge
- CodeQL merge protection enligt org-rulesetet
- Trivy Code Scanning blockerar high/critical enligt org-rulesetet
- Copilot och CodeRabbit är rådgivande, men faktiska relevanta findings ska utvärderas och åtgärdas
- inga bypass actors

Efter varje ny commit ska relevant CI, security och review-status kontrolleras igen. Kringgå aldrig repositoryskydd.

## CodeRabbit

- Anta aldrig att CodeRabbit är rate-limitad enbart för att en review dröjer eller saknas.
- Kontrollera aktuell reviewkvot med PR-kommandot `@coderabbitai rate limit` innan rate limit anges som blockerare. `@coderabbitai reviews remaining?` kan användas som alternativ. Själva kvotkontrollen ska inte räknas som en review.
- Använd `@coderabbitai review` för en ny review och `@coderabbitai full review` när en fullständig omgranskning uttryckligen behövs. Undvik onödiga manuella review-triggers eftersom incremental reviews och manuella reviews förbrukar reviewkvot.
- `@coderabbitai configuration` används för att kontrollera den faktiskt upplösta konfigurationen när arv eller UI-inställningar gör den effektiva konfigurationen oklar.
- För delad organisationspolicy ska central CodeRabbit-konfiguration i `Avkroken/coderabbit/.coderabbit.yaml` föredras när den finns. Repositoryts `.coderabbit.yaml` ska behålla `inheritance: true` och i första hand innehålla repo-specifika tillägg eller undantag.
- CodeRabbit Global Overrides används endast för organisationskrav som inte ska kunna kringgås av repositorykonfiguration.
- Vid felsökning ska effektiv konfiguration och live-resultat vägas högre än antaganden om vad `.coderabbit.yaml` ensam innebär.
- En CodeRabbit-review är rådgivande tills GitHub faktiskt visar vilket review-beslut och vilka trådar som lämnats på aktuell HEAD. Läs alltid aktuella CodeRabbit-trådar efter att CI blivit grön innan PR:n betraktas som klar.

## GitHub-native säkerhetsremediation

- GitHubs native säkerhetsfunktioner ska föredras framför repositoryägda workflows eller botkedjor som duplicerar samma funktion.
- Code Scanning-alerts får spåras genom GitHubs native länkning till nya eller befintliga Issues. Bygg inte ett eget alert→Issue-system enbart för att spegla Code Scanning-data.
- Copilot Autofix och, när tillgängligt, agentic autofix får användas för Code Scanning-alerts. En PR som skapas av GitHub/Copilot går alltid genom samma branch protection, CI, security, approval och review-thread-gates som andra PR:er.
- Dependabot security updates och Dependabot auto-triage rules är förstahandsvalet för sårbara beroenden. Undvik egna workflows som pollar Dependabot-alerts eller skapar motsvarande fix-PR:er.
- Repositoryägda workflows får inte lagra kopior av säkerhetsalert-state, poll:a GitHubs säkerhets-API för att skapa egna remediationköer eller använda reviewkommentarer som en egen AI-agentorkestrering.
- Metadataautomation för befintliga Issues/PR:er, till exempel assignee eller labels, är tillåten med minsta nödvändiga behörighet så länge den inte ändrar kod, branches, reviewbeslut eller merge-state.
- Om en hemmasnickrad automation duplicerar en GitHub-native funktion ska den avvecklas. Undantag kräver ett konkret, dokumenterat gap som GitHubs native funktion inte täcker.

## Cloudflare-kontrollplan

- `app/wrangler.jsonc` är source of truth för versionshanterad Worker-konfiguration.
- Secret-värden ligger i Cloudflare och får aldrig hårdkodas eller dupliceras i GitHub Actions.
- Cloudflare Workers Builds äger normal produktionsdeploy från `main`; GitHub Actions ska inte deploya produktion.
- `politiker` använder root `app` och deploy command `npm run migrate:production && npm run deploy && npm run verify:production`.
- `politiker-log-archive` använder root `log-archive` och deploy command `npm run deploy`.
- App-Workern är ensam D1-migrationsägare. Schemaändringar ska använda Wranglers native D1 migrations under `infra/migrations/`.
- Skapa inte parallella migrationsmotorer, deploywrappers eller GitHub Actions som muterar produktions-D1.

## Kontaktdata

- `kontakter/` är en dataproducent, inte en Cloudflare-kontrollplan.
- Scraper/importjobb får endast mutera kontaktdata med minsta nödvändiga D1-behörighet.
- De får inte provisionera resurser, deploya Workers, köra schemaändringar eller exportera live-D1 tillbaka till Git.

## GitHub Actions

- `.github/workflows/ci.yml` producerar `CI / required` och verifierar app/log-archive samt Pythonverktygen under `kontakter/`.
- `.github/workflows/docker.yml` producerar `docker`, bygger `kontakter/scraper` och laddar upp Trivy-SARIF.
- `.github/workflows/osv-scanner.yml` är repositoryts egen OSV-definition och producerar `scan-pr / osv-scan`.
- `.github/workflows/release.yml` skapar GitHub Releases från `main`; den är separat från PR-CI.
- Repositoryts workflows får inte skapa branches eller remediation-PR:er, arma eller genomföra merge, automatisera reviewbeslut, delegera remediation till AI-agenter eller lagra säkerhetsalert-snapshots. Metadataändringar på befintliga Issues/PR:er är tillåtna enligt avsnittet ovan.
- Security alerts hanteras av GitHubs native säkerhetsfunktioner. Kodändringar går genom repositoryts vanliga PR-gates.
- GitHub Actions ska pinnas till full commit-SHA.

## Säkerhet

- Alla kontoägda databasfrågor ska filtrera på `account_id`; admin-endpoints kräver uttrycklig adminbehörighet.
- `MAIL_CRED_KEY`, SMTP-lösenord, OAuth-secrets, TOTP-secrets och sessionstokens är känsliga.
- Föredra minsta nödvändiga behörighet och leverantörens standardmekanismer framför egna wrappers.

## Verifiering

Granska hela diffen mot `main` före PR. Kör relevanta tester och verifiera required CI/security samt review-state för aktuell HEAD efter varje push. Kontrollera att inga secrets, credentials, debugrester eller oavsiktliga genererade filer lagts till.

## Svarsformat

**[SKILLS.md](SKILLS.md) styr allt svarsformat. Läs den och följ den i varje svar.**

## Definition of done

En PR-baserad uppgift är klar först när implementationen är färdig, diffen självgranskad, all review-feedback utvärderad, samtliga required CI/security/review-gates gäller aktuell HEAD, relevanta review-trådar är resolved och PR:n har mergats av normal repositorypolicy eller är kvar därför att en verifierad extern gate väntar.

## PR-scope efter öppning

- När en PR har öppnats är dess avsedda scope fryst. Fortsatta commits får endast slutföra eller korrigera det scopet.
- Fel som orsakas av PR:ns befintliga ändringar ska rättas i samma PR.
- Ny funktionalitet, opportunistiska refactors eller separata förbättringar ska få en ny branch och PR från aktuell `main`.
- Efter varje korrigerande commit ska relevanta tester samt gate- och review-state verifieras på den nya HEAD:en.
