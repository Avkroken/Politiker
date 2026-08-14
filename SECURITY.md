# Säkerhetspolicy

## Omfattning

Repot innehåller två delar med olika riskprofil:

- **Webappen** (`app/`, `sender/`, `campaign/`, `healthcheck/`, `shared/`) —
  hanterar användarkonton och användarnas egna SMTP-uppgifter. Det är här
  känslig data finns.
- **Skrapan** (`kontakter/`) — hämtar publikt publicerade e-postadresser till
  förtroendevalda från kommuners och regioners egna webbplatser. Hanterar
  inga inloggningsuppgifter och inga personuppgifter utöver redan offentligt
  publicerad kontaktinformation.

## Rapportera en säkerhetsbrist

Om du upptäcker en säkerhetsbrist, **öppna inte ett publikt issue**.

Rapportera den i stället privat via
[GitHub Security Advisories](https://github.com/blixten85/politiker-webapp/security/advisories/new).

Du bör få svar inom 48 timmar. Om bristen bekräftas släpps en rättning så
snart som möjligt.

## Så skyddas känslig data

- Hemligheter sätts som miljövariabler eller Wrangler-secrets — aldrig i koden
- Användarnas SMTP-lösenord krypteras (AES-GCM) innan de lagras i D1 —
  nyckeln finns aldrig i koden
- Kontolösenord hashas med PBKDF2, aldrig i klartext
- Alla databasfrågor filtrerar på `account_id`

## Beroenden

Säkerhetsuppdateringar av tredjepartsbibliotek hanteras via Dependabot, för
både npm-delarna och skrapans Python-beroenden (Playwright, pypdf, m.fl.).
Öppna gärna ett issue om du ser en känd CVE som inte redan flaggats.
