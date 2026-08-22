# Säkerhetspolicy

## Omfattning

Repot består huvudsakligen av två delar med olika riskprofil:

- **Tjänsten** (`app/` och `shared/`) — en Cloudflare Worker som hanterar HTTP/API, kökonsument och schemalagda jobb. Den hanterar användarkonton, sessioner, mailkopplingar och användarnas brev.
- **Kontaktinsamlingen** (`kontakter/`) — hämtar redan offentligt publicerade kontaktuppgifter till förtroendevalda och synkar dem till D1.

Drift- och provisioneringskod finns i `infra/`. De tidigare separata Workers-delarna `sender/`, `campaign/` och `healthcheck/` finns inte längre; funktionerna som återstår är samlade i `app/`.

## Rapportera en säkerhetsbrist

Öppna inte ett publikt issue för en misstänkt säkerhetsbrist. Rapportera den privat via [GitHub Security Advisories](https://github.com/blixten85/politiker/security/advisories/new).

## Skydd av känslig data

- Hemligheter ska ligga i GitHub/Cloudflare-miljöer eller Wrangler secrets, aldrig i versionshistoriken.
- Mailuppgifter och andra lagrade hemligheter krypteras med AES-GCM innan de skrivs till D1; krypteringsnyckeln lagras separat som secret.
- Kontolösenord hashas med PBKDF2 och lagras aldrig i klartext.
- Kontoägda databasoperationer ska avgränsas med `account_id`; administrativa vägar kräver uttrycklig adminbehörighet.
- Temporärt brevinnehåll och bilagor omfattas av retention och rensas efter vald lagringstid.
- Publika skrivvägar skyddas med relevanta kontroller som rate limiting och Turnstile där det behövs.

## Beroenden och scanning

Dependabot hanterar uppdateringar för bland annat npm, Python, Docker och GitHub Actions. CI och separata säkerhetsworkflows används för typkontroll, beroendeskanning och code scanning.
