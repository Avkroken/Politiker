import { encryptSecret, randomId } from "../../shared/crypto";
import { testSmtpAuth } from "../../shared/smtp";
import { exchangeMicrosoftMailCode } from "../../shared/graph-mail";
import type { Env } from "./db";

// Microsoft Graph har egen throttling, separat från SMTP-gränsen för
// Outlook.com — vi har inga verifierade Graph-specifika siffror, så vi
// återanvänder samma leverantörsgräns som outlook-SMTP-presetet tills vidare.
export const MICROSOFT_GRAPH_DAILY_LIMIT = 300;

// HARDCODED_CEILING_PCT: taket vi tillåter är alltid exakt 10% under
// leverantörens kända verkliga gräns, oavsett leverantör — så att personens
// egen vanliga mailanvändning på samma konto aldrig trängs ut helt, och så
// att vi har marginal om leverantören räknar något striktare än vi tror.
// Detta är inte justerbart per leverantör; det är en medveten, enhetlig
// säkerhetsmarginal. Användaren kan därutöver själv välja att använda en
// LÄGRE andel av detta tak (se user_cap_pct), men aldrig en högre.
export const HARDCODED_CEILING_PCT = 0.9;

// providerDailyLimit = leverantörens kända verkliga gräns (mottagare/dygn) per
// juni 2026 — kan ändras av leverantören utan att vi får besked, se README
// för påminnelse om periodisk omkontroll.
export const PROVIDER_PRESETS: Record<
  string,
  { host: string; port: number; helpUrl: string; providerDailyLimit: number | null }
> = {
  gmail: {
    host: "smtp.gmail.com",
    port: 587,
    helpUrl: "https://myaccount.google.com/apppasswords",
    providerDailyLimit: 100,
  },
  outlook: {
    host: "smtp.office365.com",
    port: 587,
    helpUrl: "https://account.live.com/proofs/AppPassword",
    providerDailyLimit: 300,
  },
  icloud: {
    host: "smtp.mail.me.com",
    port: 587,
    helpUrl: "https://appleid.apple.com/account/manage",
    providerDailyLimit: 1000,
  },
  yahoo: {
    host: "smtp.mail.yahoo.com",
    port: 587,
    helpUrl: "https://login.yahoo.com/account/security",
    providerDailyLimit: 500,
  },
  generic: { host: "", port: 587, helpUrl: "", providerDailyLimit: null },
};

export function getCeiling(provider: string): number | null {
  const limit = provider === "microsoft_graph" ? MICROSOFT_GRAPH_DAILY_LIMIT : PROVIDER_PRESETS[provider]?.providerDailyLimit;
  if (limit === null || limit === undefined) return null;
  return Math.floor(limit * HARDCODED_CEILING_PCT);
}

export function computeDailyCap(provider: string, userCapPct: number): number | null {
  const ceiling = getCeiling(provider);
  if (ceiling === null) return null;
  const pct = Math.min(100, Math.max(1, Math.round(userCapPct)));
  return Math.max(1, Math.floor(ceiling * (pct / 100)));
}

export async function addMailCredential(
  env: Env,
  accountId: string,
  input: { provider: string; host?: string; port?: number; user: string; password: string; fromAddress: string; userCapPct?: number },
): Promise<{ id: string; dailyCap: number | null }> {
  const preset = PROVIDER_PRESETS[input.provider];
  if (!preset) throw new Error("Okänd leverantör");
  const host = input.provider === "generic" ? input.host! : preset.host;
  const port = input.provider === "generic" ? input.port! : preset.port;
  if (!host || !port) throw new Error("Host/port saknas");

  // Verifiera mot leverantören innan vi sparar något — direkt feedback till användaren.
  await testSmtpAuth({ host, port, user: input.user, password: input.password, fromAddress: input.fromAddress });

  const id = randomId();
  const encryptedPassword = await encryptSecret(input.password, env.MAIL_CRED_KEY);
  const userCapPct = input.userCapPct ?? 100;
  const dailyCap = computeDailyCap(input.provider, userCapPct);
  await env.DB.prepare(
    `INSERT INTO mail_credentials (id, account_id, provider, smtp_host, smtp_port, smtp_user, encrypted_password, from_address, verified_at, daily_cap, user_cap_pct, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, accountId, input.provider, host, port, input.user, encryptedPassword, input.fromAddress, Date.now(), dailyCap, userCapPct, Date.now())
    .run();

  return { id, dailyCap };
}

export async function addMicrosoftGraphMailCredential(env: Env, accountId: string, code: string): Promise<{ id: string }> {
  const tokens = await exchangeMicrosoftMailCode(env.OAUTH_MICROSOFT_CLIENT_ID!, env.OAUTH_MICROSOFT_CLIENT_SECRET!, code);

  const id = randomId();
  const encryptedAccessToken = await encryptSecret(tokens.accessToken, env.MAIL_CRED_KEY);
  const encryptedRefreshToken = await encryptSecret(tokens.refreshToken, env.MAIL_CRED_KEY);
  const dailyCap = computeDailyCap("microsoft_graph", 100);

  await env.DB.prepare(
    `INSERT INTO mail_credentials
       (id, account_id, provider, smtp_host, smtp_port, smtp_user, encrypted_password, from_address, verified_at, daily_cap, user_cap_pct, oauth_access_token, oauth_refresh_token, oauth_token_expires_at, created_at)
     VALUES (?, ?, 'microsoft_graph', 'oauth', 0, ?, '', ?, ?, ?, 100, ?, ?, ?, ?)`,
  )
    .bind(id, accountId, tokens.email, tokens.email, Date.now(), dailyCap, encryptedAccessToken, encryptedRefreshToken, tokens.expiresAt, Date.now())
    .run();

  return { id };
}

export async function updateMailCredentialCapPct(env: Env, accountId: string, credentialId: string, userCapPct: number): Promise<{ dailyCap: number | null }> {
  const cred = await env.DB.prepare(
    "SELECT provider FROM mail_credentials WHERE id = ? AND account_id = ? AND revoked_at IS NULL",
  )
    .bind(credentialId, accountId)
    .first<{ provider: string }>();
  if (!cred) throw new Error("Mailkonto saknas eller är borttaget");

  const dailyCap = computeDailyCap(cred.provider, userCapPct);
  await env.DB.prepare(
    "UPDATE mail_credentials SET user_cap_pct = ?, daily_cap = ? WHERE id = ? AND account_id = ? AND revoked_at IS NULL",
  )
    .bind(Math.min(100, Math.max(1, Math.round(userCapPct))), dailyCap, credentialId, accountId)
    .run();
  return { dailyCap };
}

export async function listMailCredentials(env: Env, accountId: string) {
  const { results } = await env.DB.prepare(
    `SELECT id, provider, smtp_host, smtp_port, from_address, verified_at, daily_cap, user_cap_pct, created_at
     FROM mail_credentials
     WHERE account_id = ? AND revoked_at IS NULL
     ORDER BY created_at DESC`,
  )
    .bind(accountId)
    .all();
  return results;
}

export async function deleteMailCredential(env: Env, accountId: string, credentialId: string): Promise<void> {
  const credential = await env.DB.prepare(
    "SELECT id FROM mail_credentials WHERE id = ? AND account_id = ? AND revoked_at IS NULL",
  ).bind(credentialId, accountId).first<{ id: string }>();
  if (!credential) return;

  const now = Date.now();

  // Historiska send_jobs har en FK till credential-raden. Hårdradering skulle
  // därför bryta referensintegriteten. Revokera i stället credentialen, ta bort
  // alla hemligheter och stoppa aktiva jobb som fortfarande använder den.
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE send_jobs
       SET status = 'cancelled', finished_at = ?
       WHERE account_id = ? AND mail_credential_id = ? AND status IN ('pending', 'sending')`,
    ).bind(now, accountId, credentialId),
    env.DB.prepare(
      `UPDATE send_job_recipients
       SET status = 'cancelled', queued_at = NULL, finished_at = ?
       WHERE send_job_id IN (
         SELECT id FROM send_jobs WHERE account_id = ? AND mail_credential_id = ?
       ) AND status IN ('pending', 'queued')`,
    ).bind(now, accountId, credentialId),
    env.DB.prepare(
      `UPDATE mail_credentials
       SET encrypted_password = '', oauth_access_token = NULL, oauth_refresh_token = NULL,
           oauth_token_expires_at = NULL, revoked_at = ?
       WHERE id = ? AND account_id = ? AND revoked_at IS NULL`,
    ).bind(now, credentialId, accountId),
  ]);
}
