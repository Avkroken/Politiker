import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { testStoredSmtpCredentialWithDeps, type StoredSmtpCredentialAuthConfig } from "../src/smtp-credential-test.ts";

const settingsSource = readFileSync(new URL("../public/app-settings.js", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const secureIndexSource = readFileSync(new URL("../src/secure-index.ts", import.meta.url), "utf8");
const mailCredentialsSource = readFileSync(new URL("../src/mail-credentials.ts", import.meta.url), "utf8");

interface CredentialFixture {
  id: string;
  account_id: string;
  provider: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  encrypted_password: string;
  from_address: string;
  revoked_at: number | null;
  verified_at: number | null;
}

class FakeCredentialDb {
  readonly rows: CredentialFixture[];

  constructor(rows: CredentialFixture[]) {
    this.rows = rows;
  }

  prepare(sql: string) {
    return {
      bind: (...args: unknown[]) => ({
        first: async <T>() => {
          if (!sql.includes("FROM mail_credentials")) throw new Error("Unexpected SELECT");
          assert.match(sql, /WHERE id = \? AND account_id = \? AND revoked_at IS NULL/);
          assert.equal(args.length, 2);
          const [credentialId, accountId] = args as [string, string];
          const row = this.rows.find((item) =>
            item.id === credentialId && item.account_id === accountId && item.revoked_at === null
          );
          if (!row) return null;
          return {
            provider: row.provider,
            smtp_host: row.smtp_host,
            smtp_port: row.smtp_port,
            smtp_user: row.smtp_user,
            encrypted_password: row.encrypted_password,
            from_address: row.from_address,
          } as T;
        },
        run: async () => {
          if (!sql.startsWith("UPDATE mail_credentials SET verified_at = ?")) throw new Error("Unexpected UPDATE");
          assert.match(sql, /WHERE id = \? AND account_id = \? AND revoked_at IS NULL/);
          assert.equal(args.length, 3);
          const [verifiedAt, credentialId, accountId] = args as [number, string, string];
          const row = this.rows.find((item) =>
            item.id === credentialId && item.account_id === accountId && item.revoked_at === null
          );
          if (row) row.verified_at = verifiedAt;
          return { meta: { changes: row ? 1 : 0 } };
        },
      }),
    };
  }
}

function credential(overrides: Partial<CredentialFixture> = {}): CredentialFixture {
  return {
    id: "cred-1",
    account_id: "account-a",
    provider: "gmail",
    smtp_host: "smtp.gmail.com",
    smtp_port: 587,
    smtp_user: "sender@example.test",
    encrypted_password: "encrypted",
    from_address: "sender@example.test",
    revoked_at: null,
    verified_at: 100,
    ...overrides,
  };
}

test("stored SMTP accounts expose an authenticated connection test action", () => {
  assert.match(settingsSource, /c\.provider!=='microsoft_graph'.*data-action="test">Testa anslutning<\/button>/s);
  assert.match(settingsSource, /\/api\/mail-credentials\/\$\{encodeURIComponent\(c\.id\)\}\/test/);
  assert.ok(indexSource.includes('rx: /^\\/api\\/mail-credentials\\/([^/]+)\\/test$/'));
  assert.match(indexSource, /testStoredSmtpCredential\(c\.env,c\.accountId,m\[1\]\)/);
});

test("stored SMTP retests require a fresh web session", () => {
  assert.ok(secureIndexSource.includes('/^\\/api\\/mail-credentials\\/[^/]+\\/test$/.test(pathname)'));
});

test("stored SMTP retests use a separate per-credential Durable Object bucket", () => {
  assert.match(mailCredentialsSource, /RATE_LIMITER\.idFromName\(`smtp-test:\$\{credentialId\}`\)/);
  assert.match(mailCredentialsSource, /JSON\.stringify\(\{ capacity: 1, refillPerMinute: 1 \}\)/);
});

test("rate-limited stored SMTP authentication stops before secret decryption", async () => {
  const row = credential({ verified_at: 100 });
  const db = new FakeCredentialDb([row]);
  let decryptCalls = 0;
  let authCalls = 0;

  await assert.rejects(
    testStoredSmtpCredentialWithDeps(db as unknown as D1Database, "account-a", "cred-1", {
      acquireTestSlot: async () => false,
      mailCredKey: "mail-key",
      decryptSecret: async () => { decryptCalls++; return "unused"; },
      testSmtpAuth: async () => { authCalls++; },
    }),
    /För många anslutningstester/,
  );
  assert.equal(decryptCalls, 0);
  assert.equal(authCalls, 0);
  assert.equal(row.verified_at, 100);
});

test("successful stored SMTP authentication updates verified_at afterwards", async () => {
  const row = credential();
  const db = new FakeCredentialDb([row]);
  let authConfig: StoredSmtpCredentialAuthConfig | null = null;

  const result = await testStoredSmtpCredentialWithDeps(db as unknown as D1Database, "account-a", "cred-1", {
    acquireTestSlot: async () => true,
    mailCredKey: "mail-key",
    now: () => 1234,
    decryptSecret: async (encoded, key) => {
      assert.equal(encoded, "encrypted");
      assert.equal(key, "mail-key");
      return "plain-password";
    },
    testSmtpAuth: async (config) => { authConfig = config; },
  });

  assert.equal(result.verifiedAt, 1234);
  assert.equal(row.verified_at, 1234);
  assert.deepEqual(authConfig, {
    host: "smtp.gmail.com",
    port: 587,
    user: "sender@example.test",
    password: "plain-password",
    fromAddress: "sender@example.test",
  });
});

test("failed stored SMTP authentication leaves verified_at unchanged", async () => {
  const row = credential({ verified_at: 100 });
  const db = new FakeCredentialDb([row]);

  await assert.rejects(
    testStoredSmtpCredentialWithDeps(db as unknown as D1Database, "account-a", "cred-1", {
      acquireTestSlot: async () => true,
    mailCredKey: "mail-key",
      now: () => 1234,
      decryptSecret: async () => "plain-password",
      testSmtpAuth: async () => { throw new Error("535 5.7.8 authentication failed"); },
    }),
    /535 5\.7\.8 authentication failed/,
  );
  assert.equal(row.verified_at, 100);
});

test("stored SMTP test fails if the credential is revoked during authentication", async () => {
  const row = credential({ verified_at: 100 });
  const db = new FakeCredentialDb([row]);

  await assert.rejects(
    testStoredSmtpCredentialWithDeps(db as unknown as D1Database, "account-a", "cred-1", {
      acquireTestSlot: async () => true,
    mailCredKey: "mail-key",
      now: () => 1234,
      decryptSecret: async () => "plain-password",
      testSmtpAuth: async () => { row.revoked_at = 999; },
    }),
    /Mailkontot ändrades under anslutningstestet/,
  );
  assert.equal(row.verified_at, 100);
});

test("stored SMTP test cannot use another account's credential", async () => {
  const row = credential({ verified_at: 100 });
  const db = new FakeCredentialDb([row]);
  let authCalls = 0;

  await assert.rejects(
    testStoredSmtpCredentialWithDeps(db as unknown as D1Database, "account-b", "cred-1", {
      acquireTestSlot: async () => true,
    mailCredKey: "mail-key",
      decryptSecret: async () => "plain-password",
      testSmtpAuth: async () => { authCalls++; },
    }),
    /Mailkonto saknas eller är borttaget/,
  );
  assert.equal(authCalls, 0);
  assert.equal(row.verified_at, 100);
});

test("stored SMTP test rejects revoked credentials without changing verified_at", async () => {
  const row = credential({ revoked_at: 99, verified_at: 100 });
  const db = new FakeCredentialDb([row]);
  let authCalls = 0;

  await assert.rejects(
    testStoredSmtpCredentialWithDeps(db as unknown as D1Database, "account-a", "cred-1", {
      acquireTestSlot: async () => true,
    mailCredKey: "mail-key",
      decryptSecret: async () => "plain-password",
      testSmtpAuth: async () => { authCalls++; },
    }),
    /Mailkonto saknas eller är borttaget/,
  );
  assert.equal(authCalls, 0);
  assert.equal(row.verified_at, 100);
});

test("Microsoft Graph credentials are not sent through the SMTP test path", async () => {
  const row = credential({ provider: "microsoft_graph" });
  const db = new FakeCredentialDb([row]);
  await assert.rejects(
    testStoredSmtpCredentialWithDeps(db as unknown as D1Database, "account-a", "cred-1", {
      acquireTestSlot: async () => true,
    mailCredKey: "mail-key",
      decryptSecret: async () => "plain-password",
      testSmtpAuth: async () => {},
    }),
    /endast SMTP-konton/,
  );
  assert.match(settingsSource, /c\.provider!=='microsoft_graph'/);
});
