import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const authSource = readFileSync(new URL("../src/auth.ts", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const secureIndexSource = readFileSync(new URL("../src/secure-index.ts", import.meta.url), "utf8");

test("reauthentication verifies account factors before refreshing the same session", () => {
  assert.match(authSource, /export async function reauthenticateAccount/);
  assert.match(authSource, /enforceAttemptLimit\(env, "reauth", accountId/);
  assert.match(authSource, /verifyPassword\(password \?\? "", account\.password_hash/);
  assert.match(authSource, /if \(account\.totp_enabled\)/);
  assert.match(authSource, /verifyTotpCode\(account\.totp_secret as string, totpCode\)/);
  assert.match(authSource, /recordFailedAttempt\(env, "reauth", accountId/);
  assert.match(authSource, /if \(!verifiedFactor\) throw new Error\("Bekräfta kontot med ditt externa inloggningssätt"\)/);
  assert.match(indexSource, /rx: \/\^\\\/api\\\/reauth\$\//);
  assert.match(indexSource, /reauthenticateAccount\(c\.env, c\.accountId, password, totpCode\)/);
  assert.match(indexSource, /writeSession\(c\.env, c\.sessionToken, c\.accountId\)/);
});

test("fresh-auth gate returns a machine-readable challenge instead of demanding logout", () => {
  assert.match(secureIndexSource, /code: "FRESH_AUTH_REQUIRED"/);
  assert.doesNotMatch(secureIndexSource, /Logga ut och in igen innan du ändrar kontots säkerhetsinställningar/);
  assert.match(indexSource, /passwordSetByUser:!!account\.password_set_by_user/);
});

test("browser reauthenticates in place and retries the original sensitive request", () => {
  assert.match(appSource, /err\.code!=='FRESH_AUTH_REQUIRED'/);
  assert.match(appSource, /await ensureFreshAuthentication\(\);return rawApi\(path,opts\)/);
  assert.match(appSource, /rawApi\('\/api\/reauth'/);
  assert.match(appSource, /Bekräfta att det är du/);
  assert.match(appSource, /Du stannar kvar på samma sida/);
  assert.match(appSource, /autocomplete="current-password"/);
  assert.match(appSource, /autocomplete="one-time-code"/);
});

test("OAuth-only sessions use a linked identity instead of silently extending freshness", () => {
  assert.match(appSource, /if\(!state\.me\.passwordSetByUser&&!state\.me\.totpEnabled\)return externalReauthentication\(\)/);
  assert.match(appSource, /rawApi\('\/api\/oauth-identities'\)/);
  assert.match(appSource, /Du behöver inte logga ut/);
  assert.match(appSource, /pending:route/);
});
