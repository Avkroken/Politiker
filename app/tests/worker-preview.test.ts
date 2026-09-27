import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const wrangler = JSON.parse(
  readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
);
const migrationConfig = JSON.parse(
  readFileSync(new URL("../wrangler.preview-migrations.jsonc", import.meta.url), "utf8"),
);
const preview = readFileSync(
  new URL("../../scripts/workers-build-preview.mjs", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const auth = readFileSync(new URL("../src/auth.ts", import.meta.url), "utf8");
const index = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const secureIndex = readFileSync(new URL("../src/secure-index.ts", import.meta.url), "utf8");
const githubPreviewWorkflow = new URL("../../.github/workflows/preview.yml", import.meta.url);

test("preview deployment is owned by Cloudflare Workers Builds, not GitHub Actions", () => {
  assert.equal(existsSync(githubPreviewWorkflow), false);
  assert.equal(
    packageJson.scripts["preview:workers-builds"],
    "node ../scripts/workers-build-preview.mjs",
  );
  assert.match(preview, /WORKERS_CI !== "1"/);
  assert.match(preview, /branch === "main"/);
  assert.doesNotMatch(preview, /secrets\./);
  assert.doesNotMatch(preview, /CLOUDFLARE_API_TOKEN_W1/);
});

test("preview resources are statically isolated from production resources", () => {
  const config = wrangler.previews;
  assert.ok(config);
  assert.equal(config.vars.PREVIEW_MODE, "1");
  assert.deepEqual(config.d1_databases.map((entry) => entry.database_name), ["politiker-preview-eu"]);
  assert.deepEqual(config.kv_namespaces.map((entry) => entry.id), ["d8a178c3910547cf91ef52a08fdf30ad"]);
  assert.deepEqual(config.r2_buckets.map((entry) => entry.bucket_name), ["politiker-preview-attachments"]);
  assert.deepEqual(config.queues.producers.map((entry) => entry.queue), ["politiker-preview-send-jobs"]);

  const serialized = JSON.stringify(config);
  assert.doesNotMatch(serialized, /78777055-bf37-4388-86ad-69bdf782e2cd/);
  assert.doesNotMatch(serialized, /23255cc6e67a4a19b19e5ea67a676b40/);
  assert.doesNotMatch(serialized, /politiker-send-jobs"/);
  assert.doesNotMatch(serialized, /politiker-attachments"/);
});

test("preview config omits production consumers, routes, cron, email and Durable Object bindings", () => {
  const config = wrangler.previews;
  assert.equal(config.queues.consumers, undefined);
  assert.equal(config.send_email, undefined);
  assert.equal(config.triggers, undefined);
  assert.equal(config.routes, undefined);
  assert.equal(config.durable_objects, undefined);
});

test("real email and sending are disabled in preview mode", () => {
  assert.match(auth, /env\.PREVIEW_MODE === "1"[\s\S]*system email suppressed/);
  assert.match(index, /PREVIEW_MODE==="1"\) return json\(\{error:"Utskick är avstängt i previewmiljön\."\},409\)/);
});

test("preview runtime does not require the production rate-limiter Durable Object", () => {
  assert.equal(wrangler.previews.durable_objects, undefined);
  assert.match(secureIndex, /if \(env\.PREVIEW_MODE === "1"\) return true;/);
});

test("preview account creation avoids production Turnstile and email dependencies", () => {
  assert.match(index, /env\.PREVIEW_MODE!=="1"&&!\(await verifyTurnstile/);
  assert.match(auth, /previewVerified: true/);
});

test("preview D1 migration target matches the preview D1 binding", () => {
  const previewDb = wrangler.previews.d1_databases[0];
  const migrationDb = migrationConfig.d1_databases[0];
  assert.equal(previewDb.database_name, migrationDb.database_name);
  assert.equal(previewDb.database_id, migrationDb.database_id);
  assert.equal(migrationDb.binding, "PREVIEW_DB");
  assert.equal(previewDb.database_id, "2f9d56ec-b0b4-491b-9f55-a01ba925b4a9");
});

test("Workers Builds preview migrates and seeds before wrangler preview", () => {
  const migration = preview.indexOf('"wrangler", "d1", "migrations", "apply"');
  const seed = preview.indexOf('academicScript, "--sql-file"');
  const execute = preview.indexOf('"wrangler", "d1", "execute"');
  const deploy = preview.indexOf('"wrangler", "preview"');
  assert.ok(migration >= 0 && seed > migration && execute > seed && deploy > execute);
});

test("workers.dev is disabled for production while Worker Preview URLs remain enabled", () => {
  assert.equal(wrangler.workers_dev, false);
  assert.equal(wrangler.preview_urls, true);
});
