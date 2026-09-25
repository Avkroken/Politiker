import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../../.github/workflows/deploy-production.yml", import.meta.url),
  "utf8",
);

test("production deployment is manual and uses the standard W1 credential", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN_W1/);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.doesNotMatch(workflow, /^\s+pull_request:/m);
  assert.match(workflow, /GITHUB_REF.*refs\/heads\/main/);
});

test("production deployment completes control-plane work before public ingress verification", () => {
  const ordered = [
    "npm run validate",
    "npm run migrate:production",
    "npm run deploy",
    "fetch_academics.py --sql-file",
    "wrangler d1 execute politiker-eu --remote --file",
    "Verify academic contacts",
    "npm run verify:production",
  ];

  let previous = -1;
  for (const marker of ordered) {
    const index = workflow.indexOf(marker);
    assert.ok(index > previous, `${marker} must occur after the previous production step`);
    previous = index;
  }
});

test("academic production sync goes through Wrangler instead of requiring a second Cloudflare credential contract", () => {
  assert.doesNotMatch(workflow, /CLOUDFLARE_ACCOUNT_ID/);
  assert.doesNotMatch(workflow, /D1_DATABASE_UUID/);
  assert.match(workflow, /EXPECTED_ACADEMIC_CONTACTS/);
  assert.match(workflow, /COUNT\(DISTINCT academic_field\)/);
});
