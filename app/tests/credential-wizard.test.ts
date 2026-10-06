import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const launcherUrl = new URL("../../scripts/setup-provider-credentials.sh", import.meta.url);
const wizardUrl = new URL("../../scripts/setup-provider-credentials.wizard.sh", import.meta.url);
const launcherPath = fileURLToPath(launcherUrl);
const wizardPath = fileURLToPath(wizardUrl);
const launcher = await readFile(launcherUrl, "utf8");
const wizard = await readFile(wizardUrl, "utf8");
const marker = "# STAGES: author this section.";
const offset = wizard.indexOf(marker);
assert.notEqual(offset, -1);
const stages = wizard.slice(offset);

test("credential wizard scripts have valid Bash syntax", () => {
  for (const path of [launcherPath, wizardPath]) {
    const result = spawnSync("bash", ["-n", path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
});

test("credential wizard remains verification-only", () => {
  assert.match(launcher, /tput\(\)/);
  assert.match(launcher, /export -f tput/);
  assert.doesNotMatch(stages, /^\s*(?:ask|ask_secret|write_env|set_secret|set_var)\s+/m);
  assert.doesNotMatch(stages, /\bwrangler\s+(?:secret|deploy)\b/);
  assert.doesNotMatch(stages, /\bgh\s+(?:secret|variable)\s+set\b/);
});

test("credential wizard covers Politiker runtime boundaries", () => {
  assert.match(stages, /MAIL_CRED_KEY/);
  assert.match(stages, /SYSTEM_SMTP_PASSWORD/);
  assert.match(stages, /TURNSTILE_SECRET/);
  assert.match(stages, /Testa anslutning/);
  assert.match(stages, /RATE_LIMITER/);
  assert.match(stages, /politiker-eu/);
  assert.match(stages, /npm run deploy:workers-builds/);
  assert.match(stages, /verify:production/);
});
