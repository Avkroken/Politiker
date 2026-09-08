# Politiker repository instructions

Politiker is a public service that lets citizens contact elected representatives using their own email account. Preserve user privacy, avoid logging message content or credentials, and treat recipient data and authentication changes as security-sensitive.

## Repository layout

- `app/` contains the TypeScript Cloudflare Worker and browser assets.
- `shared/` contains TypeScript modules shared by Worker-related code.
- `kontakter/` contains Python scrapers, verification tools, and tests for politician contact data.
- `infra/migrations/` contains database migrations.
- `log-archive/` is a separate Cloudflare Worker.
- `scripts/` contains production verification scripts.
- `forening/` contains association documents. Do not remove or rewrite these files unless the task explicitly targets them.

## Required validation

Use Node.js from `.node-version`.

For changes to `app/`, `shared/`, migrations, or browser assets:

```bash
cd app
npm ci
npm run validate
```

For changes under `kontakter/`:

```bash
cd kontakter
find . -name requirements.txt -print0 | xargs -0 -r -n1 python -m pip install -r
python -m pip install -r requirements-dev.txt
python -m pytest
```

Run the narrowest relevant tests while iterating, then run the complete command for the affected area before finishing.

## Change conventions

- Keep `GITHUB_TOKEN` permissions explicit and minimal in workflows.
- Use official GitHub actions where possible and pin actions to full commit SHAs with the release tag in a comment.
- Never commit secrets or values from `.dev.vars`, `.env`, Cloudflare, or email providers.
- Preserve existing input-safety, authentication, and recipient-validation checks when changing mail flows.
- Add or update tests for behavior changes.
- Keep Cloudflare D1 migrations forward-only; do not rewrite migrations that may already be deployed.
- Update both the TypeScript and Python sides when a shared contact-data contract changes.
- Do not create additional repository documentation unless it is necessary for the requested change.
