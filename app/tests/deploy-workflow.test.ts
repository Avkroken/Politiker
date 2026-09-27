import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const production = readFileSync(
  new URL("../../scripts/workers-build-production.mjs", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const githubDeployWorkflow = new URL(
  "../../.github/workflows/deploy-production.yml",
  import.meta.url,
);

test("production deployment is owned by Cloudflare Workers Builds, not GitHub Actions", () => {
  assert.equal(existsSync(githubDeployWorkflow), false);
  assert.equal(
    packageJson.scripts["deploy:workers-builds"],
    "node ../scripts/workers-build-production.mjs",
  );
  assert.match(production, /WORKERS_CI !== "1"/);
  assert.match(production, /WORKERS_CI_BRANCH !== "main"/);
  assert.doesNotMatch(production, /secrets\./);
  assert.doesNotMatch(production, /CLOUDFLARE_API_TOKEN_W1/);
});

test("Workers Builds production deploy preserves the verified control-plane order", () => {
  const ordered = [
    'run("npm", ["run", "validate"])',
    'run("npm", ["run", "migrate:production"])',
    'run("npm", ["run", "deploy"])',
    'academicScript, "--sql-file"',
    '"wrangler", "d1", "execute", "politiker-eu"',
    "Academia after deploy:",
    'run("npm", ["run", "verify:production"])',
  ];

  let previous = -1;
  for (const marker of ordered) {
    const index = production.indexOf(marker);
    assert.ok(index > previous, `${marker} must occur after the previous production step`);
    previous = index;
  }
});

test("academic production sync uses Wrangler inside the Cloudflare build identity", () => {
  assert.match(production, /fetch_academics\.py/);
  assert.match(production, /COUNT\(DISTINCT academic_field\)/);
  assert.match(production, /expected at least/);
  assert.doesNotMatch(production, /CLOUDFLARE_ACCOUNT_ID/);
  assert.doesNotMatch(production, /D1_DATABASE_UUID/);
});
