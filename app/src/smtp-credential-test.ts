export interface StoredSmtpCredentialAuthConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromAddress: string;
}

export interface StoredSmtpCredentialTestDeps {
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
 * Testar ett sparat SMTP-konto som tillhör accountId och inte är återkallat.
 * Efter lyckad autentisering uppdateras verified_at om kontot fortfarande är aktivt.
 *
 * @param deps - Dekryptering, SMTP-test och nyckel; now anger millisekunder sedan
 * Unix-epoken och använder Date.now om den utelämnas.
 * @returns Testets verifiedAt i millisekunder sedan Unix-epoken, även om kontot
 * har återkallats eller tagits bort före uppdateringen.
 * @throws Om kontot saknas, tillhör någon annan, är återkallat eller använder
 * Microsoft Graph. Fel från databasen och de injicerade funktionerna förs vidare.
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

  const password = await deps.decryptSecret(credential.encrypted_password, deps.mailCredKey);
  await deps.testSmtpAuth({
    host: credential.smtp_host,
    port: credential.smtp_port,
    user: credential.smtp_user,
    password,
    fromAddress: credential.from_address,
  });

  const verifiedAt = (deps.now ?? Date.now)();
  await db.prepare(
    "UPDATE mail_credentials SET verified_at = ? WHERE id = ? AND account_id = ? AND revoked_at IS NULL",
  ).bind(verifiedAt, credentialId, accountId).run();
  return { verifiedAt };
}
