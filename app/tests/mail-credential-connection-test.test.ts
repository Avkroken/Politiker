import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const settingsSource = readFileSync(new URL("../public/app-settings.js", import.meta.url), "utf8");
const credentialSource = readFileSync(new URL("../src/mail-credentials.ts", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

test("stored SMTP accounts expose an authenticated connection test action", () => {
  assert.match(settingsSource, /c\.provider!=='microsoft_graph'.*data-action="test">Testa anslutning<\/button>/s);
  assert.match(settingsSource, /\/api\/mail-credentials\/\$\{encodeURIComponent\(c\.id\)\}\/test/);
  assert.ok(indexSource.includes('rx: /^\\/api\\/mail-credentials\\/([^/]+)\\/test$/'));
  assert.match(indexSource, /testStoredSmtpCredential\(c\.env,c\.accountId,m\[1\]\)/);
});

test("stored SMTP test reuses the encrypted credential without exposing it", () => {
  assert.match(credentialSource, /WHERE id = \? AND account_id = \? AND revoked_at IS NULL/);
  assert.match(credentialSource, /decryptSecret\(credential\.encrypted_password, env\.MAIL_CRED_KEY\)/);
  assert.match(credentialSource, /testSmtpAuth\(\{[\s\S]*password,[\s\S]*fromAddress: credential\.from_address/);
  assert.match(credentialSource, /UPDATE mail_credentials SET verified_at = \?/);
  assert.match(credentialSource, /return \{ verifiedAt \};/);
});

test("Microsoft Graph credentials are not sent through the SMTP test path", () => {
  assert.match(credentialSource, /credential\.provider === "microsoft_graph"/);
  assert.match(settingsSource, /c\.provider!=='microsoft_graph'/);
});
