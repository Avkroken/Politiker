import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../../.github/workflows/preview.yml", import.meta.url), "utf8");
const prep = readFileSync(new URL("../../scripts/prepare-worker-preview.mjs", import.meta.url), "utf8");
const auth = readFileSync(new URL("../src/auth.ts", import.meta.url), "utf8");
const index = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const secureIndex = readFileSync(new URL("../src/secure-index.ts", import.meta.url), "utf8");

test("preview workflow only exposes Cloudflare credentials to same-repository pull requests", () => {
  assert.match(workflow, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN_W1/);
  assert.doesNotMatch(workflow, /CLOUDFLARE_API_TOKEN:\s*\$\{\{\s*secrets\.CLOUDFLARE_API_TOKEN\s*\}\}/);
});

test("preview resources are isolated from production resources", () => {
  for (const name of [
    "politiker-preview-eu",
    "politiker-preview-sessions",
    "politiker-preview-attachments",
    "politiker-preview-send-jobs",
  ]) {
    assert.match(prep, new RegExp(name));
  }
  assert.doesNotMatch(prep, /78777055-bf37-4388-86ad-69bdf782e2cd/);
  assert.doesNotMatch(prep, /23255cc6e67a4a19b19e5ea67a676b40/);
  assert.doesNotMatch(prep, /politiker-send-jobs"/);
  assert.doesNotMatch(prep, /politiker-attachments"/);
});

test("preview config omits production consumers, routes, cron and email bindings from previews block", () => {
  assert.match(prep, /production\.previews = \{/);
  assert.match(prep, /queues:\s*\{\s*producers:/s);
  assert.doesNotMatch(prep, /production\.previews[\s\S]*consumers:/);
  assert.doesNotMatch(prep, /production\.previews[\s\S]*send_email:/);
  assert.doesNotMatch(prep, /production\.previews[\s\S]*triggers:/);
  assert.doesNotMatch(prep, /production\.previews[\s\S]*routes:/);
});

test("real email and sending are disabled in preview mode", () => {
  assert.match(auth, /env\.PREVIEW_MODE === "1"[\s\S]*system email suppressed/);
  assert.match(index, /PREVIEW_MODE==="1"\) return json\(\{error:"Utskick är avstängt i previewmiljön\."\},409\)/);
});

test("preview runtime does not require the production rate-limiter Durable Object", () => {
  assert.doesNotMatch(prep, /durable_objects:/);
  assert.match(secureIndex, /if \(env\.PREVIEW_MODE === "1"\) return true;/);
});

test("preview account creation avoids production Turnstile and email dependencies", () => {
  assert.match(index, /env\.PREVIEW_MODE!=="1"&&!\(await verifyTurnstile/);
  assert.match(auth, /previewVerified: true/);
  assert.match(workflow, /separat D1, KV, R2 och Queue/);
});

test("preview D1 is EU-jurisdictional and migrations run before preview deployment", () => {
  assert.match(prep, /"d1", "create", names\.d1, "--jurisdiction", "eu"/);
  assert.match(prep, /"r2", "bucket", "create", names\.r2, "--jurisdiction", "eu"/);
  const migration = workflow.indexOf("Apply preview D1 migrations");
  const deploy = workflow.indexOf("Create or update Worker Preview");
  assert.ok(migration >= 0 && deploy > migration);
});

test("closed pull requests resolve the account id and remove their Worker Preview", () => {
  assert.match(workflow, /wrangler@\$\{PREVIEW_WRANGLER_VERSION\}" whoami --json/);
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID=\$account_id/);
  assert.match(workflow, /preview delete --name "pr-\$\{\{ github\.event\.pull_request\.number \}\}" --skip-confirmation/);
});


test("workers.dev is disabled for production but enabled for Preview URLs", () => {
  const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(wrangler, /"workers_dev": false/);
  assert.match(wrangler, /"preview_urls": true/);
  assert.match(prep, /previews_enabled: true/);
  assert.match(prep, /body: JSON\.stringify\(\{ enabled, previews_enabled: true \}\)/);
});

test("preview URL parsing ignores Wrangler banners before JSON", () => {
  assert.match(workflow, /sed -n '\/\^\{\/,\$p'/);
  assert.match(workflow, /\.preview\.urls\[0\] \/\/ \.deployment\.urls\[0\]/);
});
