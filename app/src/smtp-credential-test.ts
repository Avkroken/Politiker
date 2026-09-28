export interface StoredSmtpCredentialAuthConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromAddress: string;
}

export interface StoredSmtpCredentialTestDeps {
  acquireTestSlot: () => Promise<boolean>;
  decryptSecret: (encoded: string, base64Key: string) => Promise<string>;
  testSmtpAuth: (config: StoredSmtpCredentialAuthConfig) => Promise<void>;
  mailCredKey: string;
  now?: () => number;
}

interface StoredSmtpCredentialRow {
  provider: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  encrypted_password: string;
  from_address: string;
}

/**
 * Testar en lagrad SMTP-credential som tillhör det autentiserade kontot.
 *
 * Rate-limit-slotten tas före secret-dekryptering och SMTP-anslutning.
 * `verified_at` skrivs endast efter lyckad autentisering och endast om
 * credentialen fortfarande är aktiv och ägs av samma konto.
 *
 * @param db - D1-databasen som används för läsning och verifieringsuppdatering.
 * @param accountId - Det autentiserade konto som måste äga credentialen.
 * @param credentialId - Identifieraren för credentialen som ska testas.
 * @param deps - Injicerade rate-limit-, decrypt-, SMTP-auth- och clock-beroenden.
 * @returns Verifieringstidpunkten efter lyckad autentisering och beständig uppdatering.
 * @throws Om credentialen saknas, är återkallad, tillhör annat konto, använder
 * Microsoft Graph, rate-limit nekas, decrypt/SMTP-auth misslyckas eller
 * credentialen ändras innan `verified_at` kan sparas.
 */
export async function testStoredSmtpCredentialWithDeps(
  db: D1Database,
  accountId: string,
  credentialId: string,
  deps: StoredSmtpCredentialTestDeps,
): Promise<{ verifiedAt: number }> {
  const credential = await db.prepare(
    `SELECT provider, smtp_host, smtp_port, smtp_user, encrypted_password, from_address
     FROM mail_credentials
     WHERE id = ? AND account_id = ? AND revoked_at IS NULL`,
  ).bind(credentialId, accountId).first<StoredSmtpCredentialRow>();
  if (!credential) throw new Error("Mailkonto saknas eller är borttaget");
  if (credential.provider === "microsoft_graph") throw new Error("Anslutningstestet gäller endast SMTP-konton");
  if (!(await deps.acquireTestSlot())) throw new Error("För många anslutningstester — vänta en minut och försök igen");

  const password = await deps.decryptSecret(credential.encrypted_password, deps.mailCredKey);
  await deps.testSmtpAuth({
    host: credential.smtp_host,
    port: credential.smtp_port,
    user: credential.smtp_user,
    password,
    fromAddress: credential.from_address,
  });

  const verifiedAt = (deps.now ?? Date.now)();
  const update = await db.prepare(
    "UPDATE mail_credentials SET verified_at = ? WHERE id = ? AND account_id = ? AND revoked_at IS NULL",
  ).bind(verifiedAt, credentialId, accountId).run();
  if ((update.meta.changes ?? 0) < 1) throw new Error("Mailkontot ändrades under anslutningstestet");
  return { verifiedAt };
}
