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

## Agent workflow

- Never make implementation commits directly on `main`. Use a dedicated branch named `{agent}/{feature}/{YYYY-MM-DD}/{HH-mm}-{id}` for new work, keep it focused, and open a pull request to `main` when it is ready.
- Do not force-push unless the user explicitly requests it.
- Before implementation, read repository documentation, nearby code, existing tests, and CI workflows. Prefer established repository architecture, naming, tooling, and conventions over generic defaults.
- For non-trivial work, state the expected behavior and testing seam before editing production code. If the task is broad or ambiguous, record scope, constraints, acceptance checks, and split multi-part work into independently verifiable steps.
- For bugs and regressions, establish evidence and a root cause before changing production code. When a stable public seam exists, add a regression test before the fix.
- Preserve existing behavior unless the task explicitly changes it, and avoid unrelated cleanup in feature or fix commits.
- For architecture changes, make module boundaries, interfaces, and dependency implications explicit. Do not silently expand a normal task into a refactor.
- Run the narrowest relevant tests while iterating, then run the required validation above before declaring work complete.
- Treat failing CI, tests, type checks, linters, and security checks as unresolved unless the failure is demonstrably unrelated and reported.
- Review the completed diff for correctness, scope, security, and missing tests. Resolve merge or rebase conflicts by preserving the intent of both sides rather than choosing changes mechanically.
- Keep progress and handoff notes concise: current state, evidence, verification performed, remaining work, and risks. Never expose secrets, tokens, credentials, private keys, or sensitive environment values.
